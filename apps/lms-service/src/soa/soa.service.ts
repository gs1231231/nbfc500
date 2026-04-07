import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { AddSoaEntryDto } from './dto/add-entry.dto';

const PENAL_RATE_BPS = 200; // 2% per annum extra penal on overdue principal
const FORECLOSURE_CHARGE_RATE = 0.02; // 2% on outstanding principal
const DAYS_QUOTE_VALID = 7;

@Injectable()
export class SoaService {
  private readonly logger = new Logger(SoaService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // addEntry
  // -------------------------------------------------------------------------

  async addEntry(orgId: string, loanId: string, dto: AddSoaEntryDto) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
    });
    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    // Get last SOA entry to calculate running balances
    const lastEntry = await this.prisma.sOAEntry.findFirst({
      where: { loanId, organizationId: orgId },
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
    });

    const prevPrincipalBalance = lastEntry?.principalBalancePaisa ?? 0;
    const prevInterestBalance = lastEntry?.interestBalancePaisa ?? 0;
    const prevChargesBalance = lastEntry?.chargesBalancePaisa ?? 0;

    const debit = dto.debitPaisa ?? 0;
    const credit = dto.creditPaisa ?? 0;

    // Compute updated balances based on transaction type
    let principalBalance = prevPrincipalBalance;
    let interestBalance = prevInterestBalance;
    let chargesBalance = prevChargesBalance;

    switch (dto.transactionType) {
      case 'DISBURSEMENT':
        principalBalance += debit;
        break;
      case 'EMI_DEMAND':
        interestBalance += debit;
        break;
      case 'PRINCIPAL_RECEIPT':
        principalBalance = Math.max(0, principalBalance - credit);
        break;
      case 'INTEREST_RECEIPT':
        interestBalance = Math.max(0, interestBalance - credit);
        break;
      case 'PENAL_RECEIPT':
        chargesBalance = Math.max(0, chargesBalance - credit);
        break;
      case 'BOUNCE_CHARGE':
      case 'FEE_LEVIED':
      case 'INTEREST_ACCRUAL':
      case 'PROVISION':
        chargesBalance += debit;
        break;
      case 'WRITE_OFF':
        principalBalance = Math.max(0, principalBalance - debit);
        interestBalance = Math.max(0, interestBalance - debit);
        break;
      case 'WAIVER':
        interestBalance = Math.max(0, interestBalance - credit);
        chargesBalance = Math.max(0, chargesBalance - credit);
        break;
      case 'PREPAYMENT':
        principalBalance = Math.max(0, principalBalance - credit);
        break;
      case 'FORECLOSURE':
        principalBalance = 0;
        interestBalance = 0;
        chargesBalance = 0;
        break;
      case 'REVERSAL':
        // Reverse the last debit/credit — caller specifies the delta
        principalBalance -= debit;
        interestBalance -= debit;
        break;
      default:
        break;
    }

    const totalBalance = principalBalance + interestBalance + chargesBalance;

    const entry = await this.prisma.sOAEntry.create({
      data: {
        organizationId: orgId,
        loanId,
        entryDate: new Date(dto.entryDate),
        transactionType: dto.transactionType,
        description: dto.description,
        debitPaisa: debit,
        creditPaisa: credit,
        principalBalancePaisa: principalBalance,
        interestBalancePaisa: interestBalance,
        chargesBalancePaisa: chargesBalance,
        totalBalancePaisa: totalBalance,
        referenceId: dto.referenceId,
      },
    });

    this.logger.log(
      `SOA entry ${dto.transactionType} added for loan ${loanId} on ${dto.entryDate}`,
    );
    return entry;
  }

  // -------------------------------------------------------------------------
  // getSOA
  // -------------------------------------------------------------------------

  async getSOA(
    orgId: string,
    loanId: string,
    from?: string,
    to?: string,
  ) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      include: { customer: true, product: true },
    });
    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    const whereDate: { gte?: Date; lte?: Date } = {};
    if (from) whereDate.gte = new Date(from);
    if (to) whereDate.lte = new Date(to);

    const entries = await this.prisma.sOAEntry.findMany({
      where: {
        loanId,
        organizationId: orgId,
        ...(Object.keys(whereDate).length > 0 && { entryDate: whereDate }),
      },
      orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      loan: {
        loanNumber: loan.loanNumber,
        customerName: loan.customer.fullName,
        productName: loan.product.name,
        disbursedAmountPaisa: loan.disbursedAmountPaisa,
        disbursementDate: loan.disbursementDate,
        interestRateBps: loan.interestRateBps,
        tenureMonths: loan.tenureMonths,
        maturityDate: loan.maturityDate,
        loanStatus: loan.loanStatus,
      },
      entries,
      summary: {
        totalEntries: entries.length,
        openingBalance: entries[0]
          ? entries[0].totalBalancePaisa - entries[0].debitPaisa + entries[0].creditPaisa
          : 0,
        closingBalance: entries[entries.length - 1]?.totalBalancePaisa ?? 0,
      },
    };
  }

  // -------------------------------------------------------------------------
  // getForeclosureQuote
  // -------------------------------------------------------------------------

  async getForeclosureQuote(orgId: string, loanId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      include: {
        schedules: { orderBy: { installmentNumber: 'asc' } },
        charges: { where: { status: { in: ['DUE', 'PARTIALLY_PAID'] } } },
      },
    });
    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }
    if (loan.loanStatus === 'CLOSED' || loan.loanStatus === 'FORECLOSED') {
      throw new BadRequestException(`Loan ${loanId} is already ${loan.loanStatus}`);
    }

    const today = new Date();

    // Outstanding principal from loan record
    const outstandingPrincipalPaisa = loan.outstandingPrincipalPaisa;

    // Accrued interest since last payment date
    const nextDueSchedule = loan.schedules.find(
      (s) => s.status === 'PENDING' || s.status === 'PARTIALLY_PAID' || s.status === 'OVERDUE',
    );
    let accruedInterestPaisa = 0;
    if (nextDueSchedule) {
      const lastPaidDate = loan.schedules
        .filter((s) => s.status === 'PAID')
        .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())[0]
        ?.paidDate;
      const daysElapsed = lastPaidDate
        ? Math.max(
            0,
            Math.ceil((today.getTime() - new Date(lastPaidDate).getTime()) / (1000 * 60 * 60 * 24)),
          )
        : 0;
      const dailyRateBps = loan.interestRateBps / 365;
      accruedInterestPaisa = Math.round(
        (outstandingPrincipalPaisa * dailyRateBps * daysElapsed) / 10000,
      );
    }

    // Overdue charges
    const overdueChargesPaisa = loan.charges.reduce(
      (sum, c) => sum + c.amountPaisa + c.gstPaisa - c.paidPaisa - c.waivedPaisa,
      0,
    );

    // Foreclosure penalty on outstanding principal
    const foreclosureChargesPaisa = Math.round(
      outstandingPrincipalPaisa * FORECLOSURE_CHARGE_RATE,
    );
    const foreclosureGstPaisa = Math.round(foreclosureChargesPaisa * 0.18);

    const totalForeclosurePaisa =
      outstandingPrincipalPaisa +
      accruedInterestPaisa +
      overdueChargesPaisa +
      foreclosureChargesPaisa +
      foreclosureGstPaisa;

    const quoteValidUntil = new Date(
      today.getTime() + DAYS_QUOTE_VALID * 24 * 60 * 60 * 1000,
    );

    return {
      loanId,
      loanNumber: loan.loanNumber,
      quoteDate: today.toISOString(),
      quoteValidUntil: quoteValidUntil.toISOString(),
      breakdown: {
        outstandingPrincipalPaisa,
        accruedInterestPaisa,
        overdueChargesPaisa,
        foreclosureChargePaisa: foreclosureChargesPaisa,
        foreclosureChargeGstPaisa: foreclosureGstPaisa,
      },
      totalForeclosurePaisa,
      totalForeclosureRupees: (totalForeclosurePaisa / 100).toFixed(2),
      note: `Quote valid for ${DAYS_QUOTE_VALID} days. Foreclosure charge is ${FORECLOSURE_CHARGE_RATE * 100}% on outstanding principal + GST 18%.`,
    };
  }

  // -------------------------------------------------------------------------
  // getInterestCertificate
  // -------------------------------------------------------------------------

  async getInterestCertificate(orgId: string, loanId: string, fy: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      include: { customer: true, product: true },
    });
    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    // Parse FY: "2025-26" → April 1 2025 to March 31 2026
    const [startYear] = fy.split('-').map(Number);
    const fyStart = new Date(`${startYear}-04-01T00:00:00.000Z`);
    const fyEnd = new Date(`${startYear + 1}-03-31T23:59:59.999Z`);

    const entries = await this.prisma.sOAEntry.findMany({
      where: {
        loanId,
        organizationId: orgId,
        transactionType: { in: ['INTEREST_RECEIPT', 'INTEREST_ACCRUAL', 'EMI_DEMAND'] },
        entryDate: { gte: fyStart, lte: fyEnd },
      },
      orderBy: { entryDate: 'asc' },
    });

    const interestPaidPaisa = entries
      .filter((e) => e.transactionType === 'INTEREST_RECEIPT')
      .reduce((sum, e) => sum + e.creditPaisa, 0);

    const interestDemandedPaisa = entries
      .filter((e) => e.transactionType === 'EMI_DEMAND')
      .reduce((sum, e) => sum + e.debitPaisa, 0);

    return {
      loanNumber: loan.loanNumber,
      customerName: loan.customer.fullName,
      pan: loan.customer.panNumber,
      productName: loan.product.name,
      financialYear: fy,
      fyStart: fyStart.toISOString().split('T')[0],
      fyEnd: fyEnd.toISOString().split('T')[0],
      interestPaidPaisa,
      interestPaidRupees: (interestPaidPaisa / 100).toFixed(2),
      interestDemandedPaisa,
      entries,
      note: 'This certificate is for income tax purposes under Section 24(b) of the IT Act.',
    };
  }

  // -------------------------------------------------------------------------
  // getNOC
  // -------------------------------------------------------------------------

  async getNOC(orgId: string, loanId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      include: { customer: true, product: true },
    });
    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    if (!['CLOSED', 'FORECLOSED', 'SETTLED'].includes(loan.loanStatus)) {
      throw new BadRequestException(
        `NOC can only be issued for CLOSED/FORECLOSED/SETTLED loans. Current status: ${loan.loanStatus}`,
      );
    }

    return {
      loanNumber: loan.loanNumber,
      customerName: loan.customer.fullName,
      pan: loan.customer.panNumber,
      productName: loan.product.name,
      disbursedAmountPaisa: loan.disbursedAmountPaisa,
      disbursementDate: loan.disbursementDate,
      closureDate: loan.closureDate,
      loanStatus: loan.loanStatus,
      nocDate: new Date().toISOString().split('T')[0],
      declaration:
        `This is to certify that the loan account ${loan.loanNumber} has been fully ` +
        `repaid/settled as of ${loan.closureDate?.toISOString().split('T')[0] ?? 'date on record'}. ` +
        `All dues have been cleared and no amount is outstanding. ` +
        `We hereby issue this No Objection Certificate for the above loan account.`,
    };
  }
}
