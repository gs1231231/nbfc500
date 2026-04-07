import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { AddVehicleDetailDto } from './dto/add-vehicle-detail.dto';

// Maximum LTV for vehicle loans (as % of on-road price)
const MAX_LTV_PERCENT = 90; // 90% of on-road price is standard for new vehicles

const ALLOWED_VEHICLE_TYPES = ['TWO_WHEELER', 'CAR', 'COMMERCIAL', 'TRACTOR', 'CONSTRUCTION'];

@Injectable()
export class VehicleService {
  private readonly logger = new Logger(VehicleService.name);

  constructor(private readonly prisma: PrismaService) {}

  private paisaToRupees(paisa: number): number {
    return Math.round(paisa) / 100;
  }

  // ============================================================
  // Vehicle Detail Operations
  // ============================================================

  /**
   * Add vehicle details to a loan application.
   * Validates vehicle type and that the application exists.
   */
  async addVehicleDetail(orgId: string, dto: AddVehicleDetailDto) {
    if (!ALLOWED_VEHICLE_TYPES.includes(dto.vehicleType)) {
      throw new BadRequestException(
        `Invalid vehicleType "${dto.vehicleType}". Allowed: ${ALLOWED_VEHICLE_TYPES.join(', ')}`,
      );
    }

    const application = await this.prisma.loanApplication.findFirst({
      where: { id: dto.applicationId, organizationId: orgId, deletedAt: null },
    });

    if (!application) {
      throw new NotFoundException(`Loan application ${dto.applicationId} not found`);
    }

    const vehicle = await this.prisma.vehicleDetail.create({
      data: {
        organizationId: orgId,
        applicationId: dto.applicationId,
        vehicleType: dto.vehicleType,
        isNewVehicle: dto.isNewVehicle ?? true,
        make: dto.make,
        model: dto.model,
        variant: dto.variant ?? null,
        yearOfManufacture: dto.yearOfManufacture,
        registrationNumber: dto.registrationNumber ?? null,
        engineNumber: dto.engineNumber ?? null,
        chassisNumber: dto.chassisNumber ?? null,
        color: dto.color ?? null,
        exShowroomPaisa: dto.exShowroomPaisa ?? null,
        onRoadPricePaisa: dto.onRoadPricePaisa ?? null,
        insuranceValuePaisa: dto.insuranceValuePaisa ?? null,
        dealerName: dto.dealerName ?? null,
        dealerCode: dto.dealerCode ?? null,
        invoiceNumber: dto.invoiceNumber ?? null,
        invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : null,
        hypothecationStatus: 'PENDING',
        rcVerified: false,
      },
    });

    this.logger.log(`Added vehicle detail ${vehicle.id} for application ${dto.applicationId}`);

    return this.serializeVehicle(vehicle);
  }

  /**
   * Get vehicle detail by ID.
   */
  async getVehicleDetail(orgId: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicleDetail.findFirst({
      where: { id: vehicleId, organizationId: orgId },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle detail ${vehicleId} not found`);
    }

    return this.serializeVehicle(vehicle);
  }

  /**
   * Calculate LTV for a vehicle loan application.
   *
   * LTV = (Requested Loan Amount / On-Road Price) * 100
   * Max LTV for new vehicles is 90%, used vehicles may vary.
   */
  async calculateLTV(orgId: string, applicationId: string) {
    const [application, vehicle] = await Promise.all([
      this.prisma.loanApplication.findFirst({
        where: { id: applicationId, organizationId: orgId, deletedAt: null },
      }),
      this.prisma.vehicleDetail.findFirst({
        where: { organizationId: orgId, applicationId },
      }),
    ]);

    if (!application) {
      throw new NotFoundException(`Loan application ${applicationId} not found`);
    }

    if (!vehicle) {
      throw new UnprocessableEntityException(
        `No vehicle details found for application ${applicationId}`,
      );
    }

    if (!vehicle.onRoadPricePaisa) {
      throw new UnprocessableEntityException(
        `On-road price not set for vehicle — required for LTV calculation`,
      );
    }

    const requestedAmountPaisa = application.requestedAmountPaisa;
    const onRoadPricePaisa = vehicle.onRoadPricePaisa;
    const ltvPercent = (requestedAmountPaisa / onRoadPricePaisa) * 100;
    const effectiveMaxLtv = vehicle.isNewVehicle ? MAX_LTV_PERCENT : 80;
    const withinLimit = ltvPercent <= effectiveMaxLtv;

    return {
      applicationId,
      vehicleId: vehicle.id,
      vehicleType: vehicle.vehicleType,
      isNewVehicle: vehicle.isNewVehicle,
      onRoadPricePaisa,
      onRoadPriceRupees: this.paisaToRupees(onRoadPricePaisa),
      requestedAmountPaisa,
      requestedAmountRupees: this.paisaToRupees(requestedAmountPaisa),
      ltvPercent: Math.round(ltvPercent * 100) / 100,
      maxLtvPercent: effectiveMaxLtv,
      withinLimit,
      maxEligibleAmountPaisa: Math.floor(onRoadPricePaisa * (effectiveMaxLtv / 100)),
      maxEligibleAmountRupees: this.paisaToRupees(
        Math.floor(onRoadPricePaisa * (effectiveMaxLtv / 100)),
      ),
    };
  }

  /**
   * File hypothecation with RTO.
   * Marks hypothecation status as FILED with the current date.
   */
  async fileHypothecation(orgId: string, loanId: string) {
    const vehicle = await this.prisma.vehicleDetail.findFirst({
      where: { organizationId: orgId, loanId },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle detail for loan ${loanId} not found`);
    }

    if (vehicle.hypothecationStatus === 'CONFIRMED') {
      throw new UnprocessableEntityException(
        `Hypothecation is already confirmed for loan ${loanId}`,
      );
    }

    const updated = await this.prisma.vehicleDetail.update({
      where: { id: vehicle.id },
      data: {
        hypothecationStatus: 'FILED',
        hypothecationDate: new Date(),
      },
    });

    this.logger.log(`Hypothecation filed with RTO for loan ${loanId}, vehicle ${vehicle.id}`);

    return {
      ...this.serializeVehicle(updated),
      message: 'Hypothecation filed with RTO successfully',
    };
  }

  /**
   * Release hypothecation after loan closure.
   * Marks hypothecation status as RELEASED.
   */
  async releaseHypothecation(orgId: string, loanId: string) {
    const vehicle = await this.prisma.vehicleDetail.findFirst({
      where: { organizationId: orgId, loanId },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle detail for loan ${loanId} not found`);
    }

    if (vehicle.hypothecationStatus === 'PENDING') {
      throw new UnprocessableEntityException(
        `Cannot release hypothecation — it has not been filed yet`,
      );
    }

    if (vehicle.hypothecationStatus === 'RELEASED') {
      throw new UnprocessableEntityException(
        `Hypothecation has already been released for loan ${loanId}`,
      );
    }

    const updated = await this.prisma.vehicleDetail.update({
      where: { id: vehicle.id },
      data: {
        hypothecationStatus: 'RELEASED',
      },
    });

    this.logger.log(`Hypothecation released for loan ${loanId}, vehicle ${vehicle.id}`);

    return {
      ...this.serializeVehicle(updated),
      message: 'Hypothecation released successfully. RC endorsement pending at RTO.',
    };
  }

  /**
   * Verify vehicle RC via mock Vahan API check.
   * In production, integrates with https://vahan.nic.in API.
   * Mock: checks if registrationNumber is present and marks rcVerified = true.
   */
  async verifyRC(orgId: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicleDetail.findFirst({
      where: { id: vehicleId, organizationId: orgId },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle detail ${vehicleId} not found`);
    }

    if (!vehicle.registrationNumber) {
      throw new BadRequestException(
        `Registration number not set — cannot verify RC`,
      );
    }

    // Mock Vahan API check
    this.logger.log(
      `[Mock Vahan API] Checking RC for vehicle ${vehicleId}, reg: ${vehicle.registrationNumber}`,
    );

    // Simulate API call — in production replace with actual HTTP call to Vahan
    const mockVahanResponse = {
      registrationNumber: vehicle.registrationNumber,
      status: 'ACTIVE',
      ownerName: 'Verified via Vahan',
      fitnessUpto: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      hypothecation: vehicle.hypothecationStatus !== 'PENDING' ? 'YES' : 'NO',
    };

    const updated = await this.prisma.vehicleDetail.update({
      where: { id: vehicleId },
      data: { rcVerified: true },
    });

    return {
      vehicleId,
      rcVerified: true,
      vahanResponse: mockVahanResponse,
      vehicle: this.serializeVehicle(updated),
    };
  }

  // ============================================================
  // Private helpers
  // ============================================================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private serializeVehicle(vehicle: any) {
    return {
      ...vehicle,
      exShowroomRupees: vehicle.exShowroomPaisa != null ? this.paisaToRupees(vehicle.exShowroomPaisa) : null,
      onRoadPriceRupees: vehicle.onRoadPricePaisa != null ? this.paisaToRupees(vehicle.onRoadPricePaisa) : null,
      insuranceValueRupees: vehicle.insuranceValuePaisa != null ? this.paisaToRupees(vehicle.insuranceValuePaisa) : null,
    };
  }
}
