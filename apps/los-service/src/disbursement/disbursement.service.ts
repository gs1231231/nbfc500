import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import {
  ApplicationStatus,
  calculateEmi,
  generateSchedule,
} from '@bankos/common';
import { DisburseLoanDto } from './dto/disburse-loan.dto';

// GL Account codes per chart of accounts
const GL_LOAN_ASSET_CODE = '1001';
const GL_LOAN_ASSET_NAME = 'Loan Asset';
const GL_BANK_CODE = '1000';
const GL_BANK_NAME = 'Bank';

// Valid application statuses for disbursement
const DISBURSABLE_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.SANCTIONED,
  ApplicationStatus.DISBURSEMENT_PENDING,
];

@Injectable()
export class DisbursementService {
  private readonly logger = new Logger(DisbursementService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // Private helpers
  // ============================================================

  /**
   * Converts paisa amounts to rupees with 2 decimal places for API responses.
   */
  private paisaToRupees(paisa: number): number {
    return Math.round(paisa) / 100;
  }

  /**
   * Generates a unique loan number in the format LN/YYYY/NNNNNNNN.
   * Sequential counter resets per calendar year across the organization.
   */
  private async generateLoanNumber(orgId: string): Promise<string> {
    const year = new Date().getFullYear();
    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const count = await this.prisma.loan.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: yearStart, lt: yearEnd },
      },
    });

    const sequence = String(count + 1).padStart(8, '0');
    return `LN/${year}/${sequence}`;
  }

  /**
   * Serializes a Loan record for API responses.
   * Converts all paisa fields to rupees.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private serializeLoan(loan: any): any {
    return {
      ...loan,
      disbursedAmount: this.paisaToRupees(loan.disbursedAmountPaisa),
      emiAmount: this.paisaToRupees(loan.emiAmountPaisa),
      totalInterest: this.paisaToRupees(loan.totalInterestPaisa),
      outstandingPrincipal: this.paisaToRupees(loan.outstandingPrincipalPaisa),
      schedules: loan.schedules?.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: any) => ({
          ...s,
          emiAmount: this.paisaToRupees(s.emiAmountPaisa),
          principalComponent: this.paisaToRupees(s.principalComponentPaisa),
          interestComponent: this.paisaToRupees(s.interestComponentPaisa),
          openingBalance: this.paisaToRupees(s.openingBalancePaisa),
          closingBalance: this.paisaToRupees(s.closingBalancePaisa),
        }),
      ),
    };
  }

  // ============================================================
  // Service methods
  // ============================================================

  /**
   * Disburses a sanctioned loan application.
   *
   * Workflow:
   * a. Validate application status is SANCTIONED or DISBURSEMENT_PENDING.
   * b. Create a Loan record with EMI calculated using calculateEmi().
   * c. Generate the full EMI schedule using generateSchedule().
   * d. Bulk-insert LoanSchedule records for each installment.
   * e. Create GL entries: Dr "Loan Asset" (1001), Cr "Bank" (1000).
   * f. Update application status to DISBURSED.
   * g. Return the created loan with full schedule.
   *
   * All DB writes are wrapped in a single Prisma $transaction.
   *
   * Financial notes:
   * - First EMI date = disbursement date + 1 month (no broken period for simplicity).
   * - totalInterestPaisa = sum of all interest components from schedule.
   * - maturityDate = last installment due date.
   * - Bank account number is NOT logged (PII security rule).
   */
  async disburseLoan(
    orgId: string,
    applicationId: string,
    dto: DisburseLoanDto,
  ) {
    // 1. Fetch application with required relations
    const application = await this.prisma.loanApplication.findFirst({
      where: {
        id: applicationId,
        organizationId: orgId,
        deletedAt: null,
      },
      include: {
        product: true,
        branch: true,
      },
    });

    if (!application) {
      throw new NotFoundException(
        `Loan application ${applicationId} not found`,
      );
    }

    // 2. Validate status
    if (!DISBURSABLE_STATUSES.includes(application.status as ApplicationStatus)) {
      throw new UnprocessableEntityException(
        `Application status is ${application.status}. Disbursement is only allowed for ` +
          `applications in status: [${DISBURSABLE_STATUSES.join(', ')}]`,
      );
    }

    // 3. Validate sanction details are present
    if (
      application.sanctionedAmountPaisa == null ||
      application.sanctionedTenureMonths == null ||
      application.sanctionedInterestRateBps == null
    ) {
      throw new UnprocessableEntityException(
        `Application ${applicationId} is missing sanction details. ` +
          `Ensure sanctionedAmountPaisa, sanctionedTenureMonths, and sanctionedInterestRateBps are set.`,
      );
    }

    const disbursementDate = new Date(dto.disbursementDate);

    // 4. Calculate EMI using sanctioned terms
    const emiAmountPaisa = calculateEmi(
      dto.disbursementAmountPaisa,
      application.sanctionedInterestRateBps,
      application.sanctionedTenureMonths,
    );

    // 5. First EMI date = 1 month after disbursement date
    const firstEmiDate = new Date(disbursementDate);
    firstEmiDate.setMonth(firstEmiDate.getMonth() + 1);

    // 6. Generate full amortization schedule
    const scheduleEntries = generateSchedule({
      principalPaisa: dto.disbursementAmountPaisa,
      annualRateBps: application.sanctionedInterestRateBps,
      tenureMonths: application.sanctionedTenureMonths,
      disbursementDate,
      firstEmiDate,
    });

    // 7. Calculate total interest from schedule
    const totalInterestPaisa = scheduleEntries.reduce(
      (sum, entry) => sum + entry.interestPaisa,
      0,
    );

    // 8. Maturity date = last installment due date
    const maturityDate =
      scheduleEntries[scheduleEntries.length - 1].dueDate;

    // 9. Generate loan number
    const loanNumber = await this.generateLoanNumber(orgId);

    // 10. Execute all DB writes atomically
    const result = await this.prisma.$transaction(async (tx) => {
      // 10a. Create the Loan record
      const loan = await tx.loan.create({
        data: {
          organizationId: orgId,
          branchId: application.branchId,
          loanNumber,
          applicationId,
          customerId: application.customerId,
          productId: application.productId,
          disbursedAmountPaisa: dto.disbursementAmountPaisa,
          disbursementDate,
          interestRateBps: application.sanctionedInterestRateBps!,
          tenureMonths: application.sanctionedTenureMonths!,
          emiAmountPaisa,
          totalInterestPaisa,
          outstandingPrincipalPaisa: dto.disbursementAmountPaisa,
          outstandingInterestPaisa: 0,
          maturityDate,
          loanStatus: 'ACTIVE',
        },
      });

      // 10b. Create LoanSchedule records in bulk
      await tx.loanSchedule.createMany({
        data: scheduleEntries.map((entry) => ({
          loanId: loan.id,
          installmentNumber: entry.installmentNumber,
          dueDate: entry.dueDate,
          emiAmountPaisa: entry.emiAmountPaisa,
          principalComponentPaisa: entry.principalPaisa,
          interestComponentPaisa: entry.interestPaisa,
          openingBalancePaisa: entry.openingBalancePaisa,
          closingBalancePaisa: entry.closingBalancePaisa,
          status: 'PENDING',
        })),
      });

      // 10c. Create GL entries
      // Dr "Loan Asset" (1001) — asset increases
      // Cr "Bank" (1000)      — bank balance decreases
      const entryDate = disbursementDate;
      const narration =
        `Loan disbursement for application ${application.applicationNumber}, ` +
        `loan ${loanNumber}`;

      await tx.glEntry.createMany({
        data: [
          {
            organizationId: orgId,
            branchId: application.branchId,
            entryDate,
            valueDate: disbursementDate,
            accountCode: GL_LOAN_ASSET_CODE,
            accountName: GL_LOAN_ASSET_NAME,
            debitAmountPaisa: dto.disbursementAmountPaisa,
            creditAmountPaisa: 0,
            narration,
            referenceType: 'LOAN',
            referenceId: loan.id,
          },
          {
            organizationId: orgId,
            branchId: application.branchId,
            entryDate,
            valueDate: disbursementDate,
            accountCode: GL_BANK_CODE,
            accountName: GL_BANK_NAME,
            debitAmountPaisa: 0,
            creditAmountPaisa: dto.disbursementAmountPaisa,
            narration,
            referenceType: 'LOAN',
            referenceId: loan.id,
          },
        ],
      });

      // 10d. Update application status to DISBURSED
      await tx.loanApplication.update({
        where: { id: applicationId },
        data: { status: ApplicationStatus.DISBURSED },
      });

      // 10e. Fetch loan with full schedule for response
      return tx.loan.findUniqueOrThrow({
        where: { id: loan.id },
        include: {
          schedules: {
            orderBy: { installmentNumber: 'asc' },
          },
          product: {
            select: { id: true, name: true, code: true, productType: true },
          },
          branch: {
            select: { id: true, name: true, code: true },
          },
          customer: {
            select: { id: true, fullName: true, phone: true },
          },
        },
      });
    });

    this.logger.log(
      `Loan ${loanNumber} disbursed for application ${application.applicationNumber}. ` +
        `Amount: ${this.paisaToRupees(dto.disbursementAmountPaisa)} INR, ` +
        `EMI: ${this.paisaToRupees(emiAmountPaisa)} INR, ` +
        `Tenure: ${application.sanctionedTenureMonths} months`,
    );

    return this.serializeLoan(result);
  }

  /**
   * Returns a loan record with its full repayment schedule.
   *
   * Validates: loan belongs to the organization.
   */
  async getLoan(orgId: string, loanId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: {
        id: loanId,
        organizationId: orgId,
      },
      include: {
        schedules: {
          orderBy: { installmentNumber: 'asc' },
        },
        product: {
          select: { id: true, name: true, code: true, productType: true },
        },
        branch: {
          select: { id: true, name: true, code: true },
        },
        customer: {
          select: { id: true, fullName: true, phone: true },
        },
        application: {
          select: {
            id: true,
            applicationNumber: true,
            status: true,
          },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    return this.serializeLoan(loan);
  }
}
