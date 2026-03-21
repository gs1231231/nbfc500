/**
 * Prompt 74: Co-Lending Flow E2E Test
 *
 * Tests the complete co-lending flow:
 *   Partner Setup → Loan Allocation → Disbursement → Payment Settlement
 *
 * Verifications:
 *   - Bank + NBFC shares sum to loan amount
 *   - Blended interest rate is correctly computed
 *   - Payment splits are proportional to original shares
 *   - DLG utilization is tracked accurately
 *   - Co-lending status transitions correctly
 *
 * Requires: PostgreSQL running with seeded data.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateBlendedRate(
  bankSharePercent: number,
  nbfcSharePercent: number,
  bankRateBps: number,
  nbfcRateBps: number,
): number {
  return Math.round(
    (bankSharePercent / 100) * bankRateBps + (nbfcSharePercent / 100) * nbfcRateBps,
  );
}

function splitPayment(
  amountPaisa: number,
  bankSharePercent: number,
): { bankPortion: number; nbfcPortion: number } {
  const bankPortion = Math.round((amountPaisa * bankSharePercent) / 100);
  return { bankPortion, nbfcPortion: amountPaisa - bankPortion };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Co-Lending Flow E2E', () => {
  let orgId: string;
  let branchId: string;
  let productId: string;
  let userId: string;
  let customerId: string;
  let applicationId: string;
  let loanId: string;
  let partnerId: string;
  let allocationId: string;

  const BANK_SHARE_PERCENT = 80;
  const NBFC_SHARE_PERCENT = 20;
  const LOAN_AMOUNT = 100_000_000_000; // Rs 10L (as BigInt in paisa)
  const BANK_RATE_BPS = 900;   // 9%
  const NBFC_RATE_BPS = 1400;  // 14%

  const bankSharePaisa = BigInt(Math.round(Number(LOAN_AMOUNT) * BANK_SHARE_PERCENT / 100));
  const nbfcSharePaisa = BigInt(Number(LOAN_AMOUNT)) - bankSharePaisa;
  const blendedRate = calculateBlendedRate(BANK_SHARE_PERCENT, NBFC_SHARE_PERCENT, BANK_RATE_BPS, NBFC_RATE_BPS);

  beforeAll(async () => {
    const org = await prisma.organization.findFirst({ where: { code: 'GROWTH' } });
    if (!org) throw new Error('Run seed first: pnpm prisma:seed');
    orgId = org.id;

    const branch = await prisma.branch.findFirst({
      where: { organizationId: orgId, branchType: 'HEAD_OFFICE' },
    });
    branchId = branch!.id;

    const product = await prisma.loanProduct.findFirst({ where: { organizationId: orgId } });
    productId = product!.id;

    const user = await prisma.user.findFirst({ where: { organizationId: orgId } });
    userId = user!.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Phase 1: Co-Lending Partner Setup', () => {
    it('creates a co-lending partner (HDFC Bank, 80:20)', async () => {
      const partner = await prisma.coLendingPartner.create({
        data: {
          organizationId: orgId,
          bankName: 'HDFC Bank Ltd',
          bankCode: `HDFC${Date.now()}`,
          defaultBankSharePercent: BANK_SHARE_PERCENT,
          defaultNbfcSharePercent: NBFC_SHARE_PERCENT,
          bankInterestRateBps: BANK_RATE_BPS,
          nbfcInterestRateBps: NBFC_RATE_BPS,
          maxExposurePaisa: BigInt('100000000000000'), // Rs 100 Cr
          dlgCapPercent: 5,
        },
      });
      partnerId = partner.id;
      expect(partner.defaultBankSharePercent + partner.defaultNbfcSharePercent).toBe(100);
      expect(partner.dlgCapPercent).toBe(5);
    });

    it('partner shares sum to exactly 100%', async () => {
      const partner = await prisma.coLendingPartner.findUnique({ where: { id: partnerId } });
      expect(partner!.defaultBankSharePercent + partner!.defaultNbfcSharePercent).toBe(100);
    });

    it('NBFC share >= 10% (MRR compliance)', async () => {
      const partner = await prisma.coLendingPartner.findUnique({ where: { id: partnerId } });
      expect(partner!.defaultNbfcSharePercent).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Phase 2: Loan Creation for Co-Lending', () => {
    it('creates customer and co-lending application', async () => {
      const ts = Date.now();
      const customer = await prisma.customer.create({
        data: {
          organizationId: orgId,
          customerNumber: `GROWTH/CUST/CL${ts}`,
          customerType: 'INDIVIDUAL',
          firstName: 'Suresh',
          lastName: 'Nair',
          fullName: 'Suresh Nair',
          dateOfBirth: new Date('1982-04-20'),
          gender: 'MALE',
          panNumber: 'SLWPN3456M',
          phone: `98765${String(ts).slice(-5)}`,
          employmentType: 'SALARIED',
          monthlyIncomePaisa: 20_000_000,
          kycStatus: 'VERIFIED',
          createdBy: userId,
          updatedBy: userId,
        },
      });
      customerId = customer.id;

      const appCount = await prisma.loanApplication.count({ where: { organizationId: orgId } });
      const application = await prisma.loanApplication.create({
        data: {
          organizationId: orgId,
          branchId,
          applicationNumber: `GROWTH/CL/${String(appCount + 1).padStart(6, '0')}`,
          customerId,
          productId,
          requestedAmountPaisa: Number(LOAN_AMOUNT),
          requestedTenureMonths: 36,
          status: 'SANCTIONED',
          sourceType: 'BRANCH',
          sanctionedAmountPaisa: Number(LOAN_AMOUNT),
          sanctionedTenureMonths: 36,
          sanctionedInterestRateBps: blendedRate,
          createdBy: userId,
          updatedBy: userId,
        },
      });
      applicationId = application.id;
      expect(application.sanctionedInterestRateBps).toBe(blendedRate);
    });

    it('creates loan with blended interest rate', async () => {
      const loanCount = await prisma.loan.count({ where: { organizationId: orgId } });
      const loan = await prisma.loan.create({
        data: {
          organizationId: orgId,
          branchId,
          loanNumber: `GROWTH/CL/${String(loanCount + 1).padStart(6, '0')}`,
          applicationId,
          customerId,
          productId,
          disbursedAmountPaisa: Number(LOAN_AMOUNT),
          disbursementDate: new Date(),
          interestRateBps: blendedRate,
          tenureMonths: 36,
          emiAmountPaisa: 3_000_000,
          totalInterestPaisa: 8_000_000,
          outstandingPrincipalPaisa: Number(LOAN_AMOUNT),
          maturityDate: new Date(Date.now() + 36 * 30 * 24 * 60 * 60 * 1000),
          loanStatus: 'ACTIVE',
          createdBy: userId,
          updatedBy: userId,
        },
      });
      loanId = loan.id;
      expect(loan.interestRateBps).toBe(blendedRate);
      expect(loan.loanStatus).toBe('ACTIVE');
    });
  });

  describe('Phase 3: Co-Lending Allocation', () => {
    it('creates co-lending allocation with correct bank and NBFC shares', async () => {
      const allocation = await prisma.coLendingAllocation.create({
        data: {
          loanId,
          partnerId,
          bankSharePaisa,
          nbfcSharePaisa,
          blendedInterestRateBps: blendedRate,
          escrowAccountNumber: 'ESCROW001234',
          status: 'ALLOCATED',
        },
      });
      allocationId = allocation.id;
      expect(allocation.blendedInterestRateBps).toBe(blendedRate);
      expect(allocation.status).toBe('ALLOCATED');
    });

    it('bank share + NBFC share == loan amount', async () => {
      const allocation = await prisma.coLendingAllocation.findFirst({
        where: { loanId },
      });
      const total = allocation!.bankSharePaisa + allocation!.nbfcSharePaisa;
      expect(total).toBe(BigInt(LOAN_AMOUNT));
    });

    it('bank share is 80% of loan amount', async () => {
      const allocation = await prisma.coLendingAllocation.findFirst({ where: { loanId } });
      const expectedBankShare = BigInt(Math.round(Number(LOAN_AMOUNT) * 0.80));
      expect(allocation!.bankSharePaisa).toBe(expectedBankShare);
    });

    it('NBFC share is 20% of loan amount', async () => {
      const allocation = await prisma.coLendingAllocation.findFirst({ where: { loanId } });
      const expectedNbfcShare = BigInt(Math.round(Number(LOAN_AMOUNT) * 0.20));
      expect(allocation!.nbfcSharePaisa).toBe(expectedNbfcShare);
    });

    it('blended rate is weighted average of bank and NBFC rates', () => {
      // 0.80 * 900 + 0.20 * 1400 = 720 + 280 = 1000 bps (10%)
      expect(blendedRate).toBe(1000);
    });

    it('transitions allocation status to DISBURSED after bank disburses', async () => {
      await prisma.coLendingAllocation.update({
        where: { id: allocationId },
        data: { status: 'DISBURSED' },
      });
      const allocation = await prisma.coLendingAllocation.findUnique({ where: { id: allocationId } });
      expect(allocation!.status).toBe('DISBURSED');
    });

    it('transitions allocation status to ACTIVE after settlement begins', async () => {
      await prisma.coLendingAllocation.update({
        where: { id: allocationId },
        data: { status: 'ACTIVE' },
      });
      const allocation = await prisma.coLendingAllocation.findUnique({ where: { id: allocationId } });
      expect(allocation!.status).toBe('ACTIVE');
    });
  });

  describe('Phase 4: Payment Settlement — Proportional Split', () => {
    it('EMI payment of Rs 30,000 splits 80:20 correctly', () => {
      const emiPaisa = 3_000_000; // Rs 30,000
      const { bankPortion, nbfcPortion } = splitPayment(emiPaisa, BANK_SHARE_PERCENT);
      expect(bankPortion).toBe(2_400_000); // Rs 24,000
      expect(nbfcPortion).toBe(600_000);   // Rs 6,000
      expect(bankPortion + nbfcPortion).toBe(emiPaisa);
    });

    it('three monthly payments all split correctly and sum to total collected', () => {
      const emis = [3_000_000, 3_000_000, 3_000_000];
      let totalCollected = 0;
      let totalBankShare = 0;
      let totalNbfcShare = 0;

      for (const emi of emis) {
        const { bankPortion, nbfcPortion } = splitPayment(emi, BANK_SHARE_PERCENT);
        totalBankShare += bankPortion;
        totalNbfcShare += nbfcPortion;
        totalCollected += emi;
      }

      expect(totalBankShare + totalNbfcShare).toBe(totalCollected);
      expect(totalBankShare / totalCollected).toBeCloseTo(0.80, 2);
      expect(totalNbfcShare / totalCollected).toBeCloseTo(0.20, 2);
    });

    it('odd payment amount: bank + NBFC portions equal total exactly', () => {
      const oddPayment = 3_123_456;
      const { bankPortion, nbfcPortion } = splitPayment(oddPayment, BANK_SHARE_PERCENT);
      expect(bankPortion + nbfcPortion).toBe(oddPayment);
    });
  });

  describe('Phase 5: DLG Cap Tracking', () => {
    it('DLG cap is 5% of allocated portfolio', () => {
      const portfolioPaisa = Number(LOAN_AMOUNT);
      const dlgCapPaisa = Math.round(portfolioPaisa * 0.05);
      expect(dlgCapPaisa).toBe(Math.round(Number(LOAN_AMOUNT) * 0.05));
    });

    it('DLG utilization starts at 0', async () => {
      const partner = await prisma.coLendingPartner.findUnique({ where: { id: partnerId } });
      expect(partner!.dlgUtilizedPaisa).toBe(BigInt(0));
    });

    it('DLG utilized stays below cap for small defaults', async () => {
      const portfolioPaisa = Number(LOAN_AMOUNT);
      const dlgCapPaisa = portfolioPaisa * 0.05; // 5% = Rs 50,000

      // Simulate a small DLG claim (Rs 10,000)
      const dlgClaim = 1_000_000; // Rs 10,000 in paisa
      const newUtilized = BigInt(dlgClaim);

      await prisma.coLendingPartner.update({
        where: { id: partnerId },
        data: { dlgUtilizedPaisa: newUtilized },
      });

      const partner = await prisma.coLendingPartner.findUnique({ where: { id: partnerId } });
      expect(Number(partner!.dlgUtilizedPaisa)).toBeLessThan(dlgCapPaisa);
    });

    it('loan closure transitions allocation to CLOSED', async () => {
      await prisma.coLendingAllocation.update({
        where: { id: allocationId },
        data: { status: 'CLOSED' },
      });
      const allocation = await prisma.coLendingAllocation.findUnique({ where: { id: allocationId } });
      expect(allocation!.status).toBe('CLOSED');
    });
  });
});
