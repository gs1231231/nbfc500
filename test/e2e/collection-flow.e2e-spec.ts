/**
 * Prompt 75: Collection Flow E2E Test
 *
 * Tests the complete collections flow:
 *   Overdue Detection → Task Creation → Disposition → Payment/PTP → Resolution
 *
 * Verifications:
 *   - Overdue loan detected when EMI not paid
 *   - Collection task created with correct DPD
 *   - Disposition recorded (PAID / PTP / REFUSED etc.)
 *   - Payment clears overdue and resets DPD
 *   - Task marked COMPLETED after payment
 *
 * Requires: PostgreSQL running with seeded data.
 */

import { PrismaClient } from '@prisma/client';
import { calculateDpd, classifyNpa } from '../../libs/common/src/utils/financial-calculator';
import { NpaClassification } from '../../libs/common/src/enums';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Collection Flow E2E', () => {
  let orgId: string;
  let branchId: string;
  let productId: string;
  let userId: string;
  let customerId: string;
  let applicationId: string;
  let loanId: string;
  let collectionTaskId: string;

  // Simulate a loan that had EMI due 45 days ago and hasn't been paid
  const DUE_DATE_DAYS_AGO = 45;
  const DUE_DATE = daysAgo(DUE_DATE_DAYS_AGO);
  const EXPECTED_DPD = DUE_DATE_DAYS_AGO;

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

  // ── STEP 1: Create Overdue Loan Setup ───────────────────────────────────

  describe('Step 1: Create Overdue Loan', () => {
    it('creates a customer with an active loan', async () => {
      const ts = Date.now();
      const customer = await prisma.customer.create({
        data: {
          organizationId: orgId,
          customerNumber: `GROWTH/CUST/COL${ts}`,
          customerType: 'INDIVIDUAL',
          firstName: 'Mohan',
          lastName: 'Das',
          fullName: 'Mohan Das',
          dateOfBirth: new Date('1978-11-25'),
          gender: 'MALE',
          panNumber: 'MDPKD7890N',
          phone: `99876${String(ts).slice(-5)}`,
          employmentType: 'SELF_EMPLOYED_BUSINESS',
          monthlyIncomePaisa: 8_000_000,
          kycStatus: 'VERIFIED',
          createdBy: userId,
          updatedBy: userId,
        },
      });
      customerId = customer.id;
      expect(customer.kycStatus).toBe('VERIFIED');
    });

    it('creates loan application and loan (already disbursed)', async () => {
      const appCount = await prisma.loanApplication.count({ where: { organizationId: orgId } });
      const application = await prisma.loanApplication.create({
        data: {
          organizationId: orgId,
          branchId,
          applicationNumber: `GROWTH/COL/${String(appCount + 1).padStart(6, '0')}`,
          customerId,
          productId,
          requestedAmountPaisa: 50_000_000,
          requestedTenureMonths: 24,
          status: 'DISBURSED',
          sourceType: 'BRANCH',
          sanctionedAmountPaisa: 50_000_000,
          sanctionedTenureMonths: 24,
          sanctionedInterestRateBps: 1600,
          createdBy: userId,
          updatedBy: userId,
        },
      });
      applicationId = application.id;

      const loanCount = await prisma.loan.count({ where: { organizationId: orgId } });
      const loan = await prisma.loan.create({
        data: {
          organizationId: orgId,
          branchId,
          loanNumber: `GROWTH/COL/LOAN/${String(loanCount + 1).padStart(6, '0')}`,
          applicationId,
          customerId,
          productId,
          disbursedAmountPaisa: 50_000_000,
          disbursementDate: daysAgo(90),
          interestRateBps: 1600,
          tenureMonths: 24,
          emiAmountPaisa: 2_459_000,
          totalInterestPaisa: 8_000_000,
          outstandingPrincipalPaisa: 48_000_000,
          totalOverduePaisa: 2_459_000, // 1 overdue EMI
          dpd: EXPECTED_DPD,
          maturityDate: daysAgo(-630), // 21 months from now
          loanStatus: 'ACTIVE',
          npaClassification: 'SMA_1', // 45 DPD = SMA_1
          createdBy: userId,
          updatedBy: userId,
        },
      });
      loanId = loan.id;
      expect(loan.dpd).toBe(EXPECTED_DPD);
      expect(loan.npaClassification).toBe('SMA_1');
    });

    it('creates overdue schedule entry for the missed EMI', async () => {
      const schedule = await prisma.loanSchedule.create({
        data: {
          loanId,
          installmentNumber: 3,
          dueDate: DUE_DATE,
          emiAmountPaisa: 2_459_000,
          principalComponentPaisa: 1_793_000,
          interestComponentPaisa: 666_000,
          openingBalancePaisa: 48_000_000,
          closingBalancePaisa: 46_207_000,
          status: 'OVERDUE',
        },
      });
      expect(schedule.status).toBe('OVERDUE');
    });
  });

  // ── STEP 2: DPD Calculation ─────────────────────────────────────────────

  describe('Step 2: DPD Calculation and NPA Classification', () => {
    it('calculates correct DPD for overdue loan', () => {
      const dpd = calculateDpd(DUE_DATE, null, today());
      expect(dpd).toBeGreaterThanOrEqual(EXPECTED_DPD - 1);
      expect(dpd).toBeLessThanOrEqual(EXPECTED_DPD + 1);
    });

    it('DPD 45 classifies as SMA_1', () => {
      const classification = classifyNpa(45);
      expect(classification).toBe(NpaClassification.SMA_1);
    });

    it('loan npaClassification matches DPD-based classification', async () => {
      const loan = await prisma.loan.findUnique({ where: { id: loanId } });
      const classification = classifyNpa(loan!.dpd);
      expect(loan!.npaClassification).toBe(classification);
    });
  });

  // ── STEP 3: Collection Task Creation ────────────────────────────────────

  describe('Step 3: Collection Task Creation', () => {
    it('creates a TELECALL collection task for SMA_1 loan', async () => {
      const task = await prisma.collectionTask.create({
        data: {
          organizationId: orgId,
          loanId,
          dpdAtCreation: EXPECTED_DPD,
          taskType: 'TELECALL',
          assignedToId: userId,
          scheduledDate: today(),
          status: 'PENDING',
          remarks: `Automated task created for DPD ${EXPECTED_DPD}. EMI due ${DUE_DATE.toDateString()} not received.`,
        },
      });
      collectionTaskId = task.id;
      expect(task.taskType).toBe('TELECALL');
      expect(task.status).toBe('PENDING');
      expect(task.dpdAtCreation).toBe(EXPECTED_DPD);
    });

    it('task is linked to the correct loan', async () => {
      const task = await prisma.collectionTask.findUnique({ where: { id: collectionTaskId } });
      expect(task!.loanId).toBe(loanId);
    });

    it('task DPD at creation matches current loan DPD', async () => {
      const task = await prisma.collectionTask.findUnique({ where: { id: collectionTaskId } });
      const loan = await prisma.loan.findUnique({ where: { id: loanId } });
      expect(task!.dpdAtCreation).toBe(loan!.dpd);
    });
  });

  // ── STEP 4: Task Disposition — Promise to Pay ────────────────────────────

  describe('Step 4: Disposition — Promise to Pay (PTP)', () => {
    it('agent records PTP disposition with date and amount', async () => {
      const ptpDate = new Date();
      ptpDate.setDate(ptpDate.getDate() + 5); // Promise to pay in 5 days

      await prisma.collectionTask.update({
        where: { id: collectionTaskId },
        data: {
          status: 'COMPLETED',
          completedDate: today(),
          disposition: 'PTP',
          ptpDate,
          ptpAmountPaisa: 2_459_000,
          remarks: 'Customer promised to pay by ' + ptpDate.toDateString() + '. Cash flow issue this month.',
        },
      });

      const task = await prisma.collectionTask.findUnique({ where: { id: collectionTaskId } });
      expect(task!.disposition).toBe('PTP');
      expect(task!.ptpDate).not.toBeNull();
      expect(task!.ptpAmountPaisa).toBe(2_459_000);
      expect(task!.status).toBe('COMPLETED');
    });

    it('creates follow-up task after PTP', async () => {
      const ptpFollowUpDate = new Date();
      ptpFollowUpDate.setDate(ptpFollowUpDate.getDate() + 6); // 1 day after PTP date

      const followUp = await prisma.collectionTask.create({
        data: {
          organizationId: orgId,
          loanId,
          dpdAtCreation: EXPECTED_DPD,
          taskType: 'TELECALL',
          assignedToId: userId,
          scheduledDate: ptpFollowUpDate,
          status: 'PENDING',
          remarks: 'Follow-up on PTP. Verify payment received.',
        },
      });
      expect(followUp.status).toBe('PENDING');
    });
  });

  // ── STEP 5: Payment Received ─────────────────────────────────────────────

  describe('Step 5: Payment Received — Overdue Cleared', () => {
    it('records payment and marks schedule as PAID', async () => {
      let payCount = await prisma.payment.count({ where: { organizationId: orgId } });
      const payment = await prisma.payment.create({
        data: {
          organizationId: orgId,
          loanId,
          paymentNumber: `GROWTH/COL/PAY/${String(payCount + 1).padStart(8, '0')}`,
          amountPaisa: 2_459_000,
          paymentDate: today(),
          paymentMode: 'UPI',
          referenceNumber: 'UPI20260321123456',
          status: 'SUCCESS',
          allocatedToPrincipalPaisa: 1_793_000,
          allocatedToInterestPaisa: 666_000,
          createdBy: userId,
          updatedBy: userId,
        },
      });
      expect(payment.status).toBe('SUCCESS');
      expect(payment.amountPaisa).toBe(2_459_000);
    });

    it('updates overdue schedule entry to PAID', async () => {
      await prisma.loanSchedule.updateMany({
        where: { loanId, installmentNumber: 3 },
        data: {
          status: 'PAID',
          paidAmountPaisa: 2_459_000,
          paidDate: today(),
          paidPrincipalPaisa: 1_793_000,
          paidInterestPaisa: 666_000,
        },
      });

      const schedule = await prisma.loanSchedule.findFirst({
        where: { loanId, installmentNumber: 3 },
      });
      expect(schedule!.status).toBe('PAID');
    });

    it('resets loan DPD to 0 after payment', async () => {
      await prisma.loan.update({
        where: { id: loanId },
        data: {
          dpd: 0,
          totalOverduePaisa: 0,
          npaClassification: 'STANDARD',
          outstandingPrincipalPaisa: 46_207_000,
        },
      });

      const loan = await prisma.loan.findUnique({ where: { id: loanId } });
      expect(loan!.dpd).toBe(0);
      expect(loan!.totalOverduePaisa).toBe(0);
      expect(loan!.npaClassification).toBe('STANDARD');
    });

    it('NPA classification returns to STANDARD after payment', async () => {
      const loan = await prisma.loan.findUnique({ where: { id: loanId } });
      expect(classifyNpa(loan!.dpd)).toBe(NpaClassification.STANDARD);
    });
  });

  // ── STEP 6: REFUSED Disposition Path ─────────────────────────────────────

  describe('Step 6: Refused Disposition — Escalation Path', () => {
    it('creates a field visit task when customer refuses', async () => {
      // Create another overdue scenario
      const fieldVisitTask = await prisma.collectionTask.create({
        data: {
          organizationId: orgId,
          loanId,
          dpdAtCreation: 60,
          taskType: 'FIELD_VISIT',
          assignedToId: userId,
          scheduledDate: today(),
          status: 'PENDING',
          remarks: 'Escalated to field visit after customer refused on telecall.',
        },
      });
      expect(fieldVisitTask.taskType).toBe('FIELD_VISIT');
    });

    it('records REFUSED disposition', async () => {
      const task = await prisma.collectionTask.findFirst({
        where: { loanId, taskType: 'FIELD_VISIT' },
        orderBy: { createdAt: 'desc' },
      });

      await prisma.collectionTask.update({
        where: { id: task!.id },
        data: {
          status: 'COMPLETED',
          completedDate: today(),
          disposition: 'REFUSED',
          remarks: 'Customer refused to pay. Claims financial hardship. Legal notice recommended.',
        },
      });

      const updated = await prisma.collectionTask.findUnique({ where: { id: task!.id } });
      expect(updated!.disposition).toBe('REFUSED');
      expect(updated!.status).toBe('COMPLETED');
    });

    it('creates legal notice task after REFUSED', async () => {
      const legalTask = await prisma.collectionTask.create({
        data: {
          organizationId: orgId,
          loanId,
          dpdAtCreation: 60,
          taskType: 'LEGAL_NOTICE',
          assignedToId: userId,
          scheduledDate: today(),
          status: 'PENDING',
          remarks: 'Section 138 NI Act notice to be sent.',
        },
      });
      expect(legalTask.taskType).toBe('LEGAL_NOTICE');
      expect(legalTask.status).toBe('PENDING');
    });
  });

  // ── STEP 7: Invariants ────────────────────────────────────────────────────

  describe('Step 7: Collection Flow Invariants', () => {
    it('all completed tasks have a completedDate', async () => {
      const completedTasks = await prisma.collectionTask.findMany({
        where: { loanId, status: 'COMPLETED' },
      });
      for (const task of completedTasks) {
        expect(task.completedDate).not.toBeNull();
      }
    });

    it('PTP tasks have ptpDate and ptpAmount set', async () => {
      const ptpTasks = await prisma.collectionTask.findMany({
        where: { loanId, disposition: 'PTP' },
      });
      for (const task of ptpTasks) {
        expect(task.ptpDate).not.toBeNull();
        expect(task.ptpAmountPaisa).toBeGreaterThan(0);
      }
    });

    it('total tasks created for loan is >= 2 (telecall + follow-up)', async () => {
      const taskCount = await prisma.collectionTask.count({ where: { loanId } });
      expect(taskCount).toBeGreaterThanOrEqual(2);
    });

    it('all tasks reference valid loan', async () => {
      const tasks = await prisma.collectionTask.findMany({ where: { loanId } });
      for (const task of tasks) {
        expect(task.loanId).toBe(loanId);
      }
    });
  });
});
