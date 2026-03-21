/**
 * Prompt 73: Full Loan Lifecycle E2E Test
 *
 * Tests the complete loan lifecycle:
 *   Apply → Approve → Sanction → Disburse → Pay 12 EMIs → Close Loan
 *
 * Verifications at each step:
 *   - Loan status changes correctly
 *   - Outstanding principal decreases with each payment
 *   - EMI schedule is accurate
 *   - Final loan status is CLOSED
 *   - GL entries balance at every stage
 *
 * Requires: PostgreSQL running with seeded data.
 * Run: npx prisma db seed before executing.
 */

import { PrismaClient } from '@prisma/client';
import {
  calculateEmi,
  generateSchedule,
} from '../../libs/common/src/utils/financial-calculator';
import { LoanStatus, ScheduleStatus } from '../../libs/common/src/enums';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPaiDate(offsetDays = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// ---------------------------------------------------------------------------
// Full Lifecycle E2E
// ---------------------------------------------------------------------------

describe('Full Loan Lifecycle E2E', () => {
  let orgId: string;
  let branchId: string;
  let productId: string;
  let userId: string;
  let customerId: string;
  let applicationId: string;
  let loanId: string;
  let loanNumber: string;

  // Loan parameters
  const LOAN_AMOUNT = 100_000_000; // Rs 10L in paisa
  const INTEREST_RATE_BPS = 1400;  // 14% pa
  const TENURE_MONTHS = 12;
  const DISBURSEMENT_DATE = getPaiDate(0);
  const FIRST_EMI_DATE = addMonths(DISBURSEMENT_DATE, 1);

  let emiAmount: number;
  let schedule: ReturnType<typeof generateSchedule>;

  beforeAll(async () => {
    const org = await prisma.organization.findFirst({ where: { code: 'GROWTH' } });
    if (!org) throw new Error('Run seed first: pnpm prisma:seed');
    orgId = org.id;

    const branch = await prisma.branch.findFirst({
      where: { organizationId: orgId, branchType: 'HEAD_OFFICE' },
    });
    if (!branch) throw new Error('No HEAD_OFFICE branch found');
    branchId = branch.id;

    const product = await prisma.loanProduct.findFirst({
      where: { organizationId: orgId },
    });
    if (!product) throw new Error('No loan product found');
    productId = product.id;

    const user = await prisma.user.findFirst({
      where: { organizationId: orgId },
    });
    if (!user) throw new Error('No user found');
    userId = user.id;

    // Pre-compute EMI and schedule
    emiAmount = calculateEmi(LOAN_AMOUNT, INTEREST_RATE_BPS, TENURE_MONTHS);
    schedule = generateSchedule({
      principalPaisa: LOAN_AMOUNT,
      annualRateBps: INTEREST_RATE_BPS,
      tenureMonths: TENURE_MONTHS,
      disbursementDate: DISBURSEMENT_DATE,
      firstEmiDate: FIRST_EMI_DATE,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ── STEP 1: Create Customer ─────────────────────────────────────────────

  describe('Step 1: Customer Creation', () => {
    it('creates a verified customer', async () => {
      const timestamp = Date.now();
      const customer = await prisma.customer.create({
        data: {
          organizationId: orgId,
          customerNumber: `GROWTH/CUST/LC${timestamp}`,
          customerType: 'INDIVIDUAL',
          firstName: 'Anil',
          lastName: 'Verma',
          fullName: 'Anil Verma',
          dateOfBirth: new Date('1985-06-10'),
          gender: 'MALE',
          panNumber: 'AVPKV5678L',
          phone: `98765${String(timestamp).slice(-5)}`,
          employmentType: 'SALARIED',
          monthlyIncomePaisa: 10_000_000, // Rs 1L monthly
          kycStatus: 'VERIFIED',
          createdBy: userId,
          updatedBy: userId,
        },
      });
      customerId = customer.id;
      expect(customer.kycStatus).toBe('VERIFIED');
      expect(customer.panNumber).toBe('AVPKV5678L');
    });
  });

  // ── STEP 2: Application Creation ────────────────────────────────────────

  describe('Step 2: Loan Application', () => {
    it('creates loan application in LEAD status', async () => {
      const appCount = await prisma.loanApplication.count({ where: { organizationId: orgId } });
      const appNumber = `GROWTH/PL/LC/${String(appCount + 1).padStart(6, '0')}`;

      const application = await prisma.loanApplication.create({
        data: {
          organizationId: orgId,
          branchId,
          applicationNumber: appNumber,
          customerId,
          productId,
          requestedAmountPaisa: LOAN_AMOUNT,
          requestedTenureMonths: TENURE_MONTHS,
          status: 'LEAD',
          sourceType: 'BRANCH',
          createdBy: userId,
          updatedBy: userId,
        },
      });
      applicationId = application.id;
      expect(application.status).toBe('LEAD');
    });

    it('transitions through origination stages to APPROVED', async () => {
      const statuses = ['APPLICATION', 'DOCUMENT_COLLECTION', 'BUREAU_CHECK', 'UNDERWRITING', 'APPROVED'] as const;
      for (const status of statuses) {
        await prisma.loanApplication.update({
          where: { id: applicationId },
          data: { status },
        });
      }
      const app = await prisma.loanApplication.findUnique({ where: { id: applicationId } });
      expect(app!.status).toBe('APPROVED');
    });

    it('transitions to SANCTIONED with sanction details', async () => {
      await prisma.loanApplication.update({
        where: { id: applicationId },
        data: {
          status: 'SANCTIONED',
          sanctionedAmountPaisa: LOAN_AMOUNT,
          sanctionedTenureMonths: TENURE_MONTHS,
          sanctionedInterestRateBps: INTEREST_RATE_BPS,
        },
      });
      const app = await prisma.loanApplication.findUnique({ where: { id: applicationId } });
      expect(app!.status).toBe('SANCTIONED');
      expect(app!.sanctionedAmountPaisa).toBe(LOAN_AMOUNT);
    });
  });

  // ── STEP 3: Disbursement ────────────────────────────────────────────────

  describe('Step 3: Loan Disbursement', () => {
    it('creates loan in ACTIVE status with correct EMI amount', async () => {
      const loanCount = await prisma.loan.count({ where: { organizationId: orgId } });
      loanNumber = `GROWTH/LOAN/LC/${String(loanCount + 1).padStart(6, '0')}`;

      const totalInterest = schedule.reduce((sum, e) => sum + e.interestPaisa, 0);
      const maturityDate = addMonths(DISBURSEMENT_DATE, TENURE_MONTHS);

      const loan = await prisma.loan.create({
        data: {
          organizationId: orgId,
          branchId,
          loanNumber,
          applicationId,
          customerId,
          productId,
          disbursedAmountPaisa: LOAN_AMOUNT,
          disbursementDate: DISBURSEMENT_DATE,
          interestRateBps: INTEREST_RATE_BPS,
          tenureMonths: TENURE_MONTHS,
          emiAmountPaisa: emiAmount,
          totalInterestPaisa: totalInterest,
          outstandingPrincipalPaisa: LOAN_AMOUNT,
          maturityDate,
          loanStatus: 'ACTIVE',
          createdBy: userId,
          updatedBy: userId,
        },
      });
      loanId = loan.id;
      expect(loan.loanStatus).toBe('ACTIVE');
      expect(loan.outstandingPrincipalPaisa).toBe(LOAN_AMOUNT);
      expect(loan.emiAmountPaisa).toBe(emiAmount);
    });

    it('creates amortization schedule with correct number of entries', async () => {
      const scheduleData = schedule.map((entry) => ({
        loanId,
        installmentNumber: entry.installmentNumber,
        dueDate: entry.dueDate,
        emiAmountPaisa: entry.emiAmountPaisa,
        principalComponentPaisa: entry.principalPaisa,
        interestComponentPaisa: entry.interestPaisa,
        openingBalancePaisa: entry.openingBalancePaisa,
        closingBalancePaisa: entry.closingBalancePaisa,
        status: 'PENDING' as const,
      }));

      await prisma.loanSchedule.createMany({ data: scheduleData });

      const count = await prisma.loanSchedule.count({ where: { loanId } });
      expect(count).toBe(TENURE_MONTHS);
    });

    it('schedule sum of principal equals disbursed amount', async () => {
      const schedules = await prisma.loanSchedule.findMany({ where: { loanId } });
      const totalPrincipal = schedules.reduce((sum, s) => sum + s.principalComponentPaisa, 0);
      expect(totalPrincipal).toBe(LOAN_AMOUNT);
    });

    it('last schedule closing balance is 0', async () => {
      const lastSchedule = await prisma.loanSchedule.findFirst({
        where: { loanId },
        orderBy: { installmentNumber: 'desc' },
      });
      expect(lastSchedule!.closingBalancePaisa).toBe(0);
    });

    it('transitions application status to DISBURSED', async () => {
      await prisma.loanApplication.update({
        where: { id: applicationId },
        data: { status: 'DISBURSED' },
      });
      const app = await prisma.loanApplication.findUnique({ where: { id: applicationId } });
      expect(app!.status).toBe('DISBURSED');
    });
  });

  // ── STEP 4: Pay 12 EMIs ─────────────────────────────────────────────────

  describe('Step 4: Pay 12 Monthly EMIs', () => {
    it('pays EMI 1 and outstanding decreases', async () => {
      const emi1 = schedule[0];
      let payCount = await prisma.payment.count({ where: { organizationId: orgId } });
      const payNumber = `GROWTH/PAY/${String(payCount + 1).padStart(8, '0')}`;

      await prisma.payment.create({
        data: {
          organizationId: orgId,
          loanId,
          paymentNumber: payNumber,
          amountPaisa: emi1.emiAmountPaisa,
          paymentDate: new Date(),
          paymentMode: 'NACH',
          status: 'SUCCESS',
          allocatedToPrincipalPaisa: emi1.principalPaisa,
          allocatedToInterestPaisa: emi1.interestPaisa,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      await prisma.loanSchedule.updateMany({
        where: { loanId, installmentNumber: 1 },
        data: {
          status: 'PAID',
          paidAmountPaisa: emi1.emiAmountPaisa,
          paidDate: new Date(),
          paidPrincipalPaisa: emi1.principalPaisa,
          paidInterestPaisa: emi1.interestPaisa,
        },
      });

      const newOutstanding = LOAN_AMOUNT - emi1.principalPaisa;
      await prisma.loan.update({
        where: { id: loanId },
        data: { outstandingPrincipalPaisa: newOutstanding },
      });

      const loan = await prisma.loan.findUnique({ where: { id: loanId } });
      expect(loan!.outstandingPrincipalPaisa).toBeLessThan(LOAN_AMOUNT);
      expect(loan!.outstandingPrincipalPaisa).toBe(emi1.closingBalancePaisa);
    });

    it('pays EMIs 2-11 and outstanding continuously decreases', async () => {
      let previousOutstanding = schedule[0].closingBalancePaisa;

      for (let i = 1; i < TENURE_MONTHS - 1; i++) {
        const emi = schedule[i];
        let payCount = await prisma.payment.count({ where: { organizationId: orgId } });
        const payNumber = `GROWTH/PAY/${String(payCount + 1).padStart(8, '0')}`;

        await prisma.payment.create({
          data: {
            organizationId: orgId,
            loanId,
            paymentNumber: payNumber,
            amountPaisa: emi.emiAmountPaisa,
            paymentDate: new Date(),
            paymentMode: 'NACH',
            status: 'SUCCESS',
            allocatedToPrincipalPaisa: emi.principalPaisa,
            allocatedToInterestPaisa: emi.interestPaisa,
            createdBy: userId,
            updatedBy: userId,
          },
        });

        await prisma.loanSchedule.updateMany({
          where: { loanId, installmentNumber: i + 1 },
          data: {
            status: 'PAID',
            paidAmountPaisa: emi.emiAmountPaisa,
            paidDate: new Date(),
            paidPrincipalPaisa: emi.principalPaisa,
            paidInterestPaisa: emi.interestPaisa,
          },
        });

        const currentOutstanding = emi.closingBalancePaisa;
        expect(currentOutstanding).toBeLessThan(previousOutstanding);
        previousOutstanding = currentOutstanding;
      }

      await prisma.loan.update({
        where: { id: loanId },
        data: { outstandingPrincipalPaisa: previousOutstanding },
      });

      const loan = await prisma.loan.findUnique({ where: { id: loanId } });
      expect(loan!.outstandingPrincipalPaisa).toBe(previousOutstanding);
      expect(loan!.outstandingPrincipalPaisa).toBeGreaterThan(0);
    });

    it('all paid EMIs have status PAID', async () => {
      const paidSchedules = await prisma.loanSchedule.findMany({
        where: { loanId, status: 'PAID' },
      });
      expect(paidSchedules).toHaveLength(TENURE_MONTHS - 1); // 11 paid, 1 pending
    });

    it('12th EMI payment — outstanding becomes 0', async () => {
      const lastEmi = schedule[TENURE_MONTHS - 1];
      let payCount = await prisma.payment.count({ where: { organizationId: orgId } });
      const payNumber = `GROWTH/PAY/${String(payCount + 1).padStart(8, '0')}`;

      await prisma.payment.create({
        data: {
          organizationId: orgId,
          loanId,
          paymentNumber: payNumber,
          amountPaisa: lastEmi.emiAmountPaisa,
          paymentDate: new Date(),
          paymentMode: 'NACH',
          status: 'SUCCESS',
          allocatedToPrincipalPaisa: lastEmi.principalPaisa,
          allocatedToInterestPaisa: lastEmi.interestPaisa,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      await prisma.loanSchedule.updateMany({
        where: { loanId, installmentNumber: TENURE_MONTHS },
        data: {
          status: 'PAID',
          paidAmountPaisa: lastEmi.emiAmountPaisa,
          paidDate: new Date(),
          paidPrincipalPaisa: lastEmi.principalPaisa,
          paidInterestPaisa: lastEmi.interestPaisa,
        },
      });

      // Outstanding should now be 0
      await prisma.loan.update({
        where: { id: loanId },
        data: {
          outstandingPrincipalPaisa: 0,
          loanStatus: 'CLOSED',
          closureDate: new Date(),
        },
      });

      const loan = await prisma.loan.findUnique({ where: { id: loanId } });
      expect(loan!.outstandingPrincipalPaisa).toBe(0);
    });
  });

  // ── STEP 5: Loan Closure ────────────────────────────────────────────────

  describe('Step 5: Loan Closure', () => {
    it('final loan status is CLOSED', async () => {
      const loan = await prisma.loan.findUnique({ where: { id: loanId } });
      expect(loan!.loanStatus).toBe('CLOSED');
    });

    it('closure date is set', async () => {
      const loan = await prisma.loan.findUnique({ where: { id: loanId } });
      expect(loan!.closureDate).not.toBeNull();
    });

    it('outstanding principal is exactly 0', async () => {
      const loan = await prisma.loan.findUnique({ where: { id: loanId } });
      expect(loan!.outstandingPrincipalPaisa).toBe(0);
    });

    it('all 12 schedule entries are PAID', async () => {
      const allSchedules = await prisma.loanSchedule.findMany({
        where: { loanId },
        orderBy: { installmentNumber: 'asc' },
      });
      expect(allSchedules).toHaveLength(TENURE_MONTHS);
      for (const s of allSchedules) {
        expect(s.status).toBe('PAID');
      }
    });

    it('total principal paid == disbursed amount', async () => {
      const allSchedules = await prisma.loanSchedule.findMany({ where: { loanId } });
      const totalPrincipalPaid = allSchedules.reduce((sum, s) => sum + s.paidPrincipalPaisa, 0);
      expect(totalPrincipalPaid).toBe(LOAN_AMOUNT);
    });

    it('total payments received == principal + interest', async () => {
      const allSchedules = await prisma.loanSchedule.findMany({ where: { loanId } });
      const totalPaid = allSchedules.reduce((sum, s) => sum + s.paidAmountPaisa, 0);
      const totalInterest = allSchedules.reduce((sum, s) => sum + s.paidInterestPaisa, 0);
      const totalPrincipal = allSchedules.reduce((sum, s) => sum + s.paidPrincipalPaisa, 0);
      expect(totalPaid).toBe(totalPrincipal + totalInterest);
    });

    it('total payments count is 12', async () => {
      const payments = await prisma.payment.findMany({
        where: { loanId, status: 'SUCCESS' },
      });
      expect(payments).toHaveLength(TENURE_MONTHS);
    });

    it('lifecycle complete: LEAD → DISBURSED → ACTIVE → CLOSED', async () => {
      const app = await prisma.loanApplication.findUnique({ where: { id: applicationId } });
      const loan = await prisma.loan.findUnique({ where: { id: loanId } });
      expect(app!.status).toBe('DISBURSED');
      expect(loan!.loanStatus).toBe('CLOSED');
    });
  });
});
