# BankOS UAT Script — Acceptance Testing Guide

**Version:** 1.0
**Date:** March 2026
**Audience:** NBFC Operations Teams, QA Testers, Implementation Partners

---

## Overview

This document provides a step-by-step User Acceptance Testing (UAT) checklist for the BankOS NBFC Lending Platform. Each test scenario includes the steps to perform, the expected results, and a pass/fail checkbox.

Use this script during client onboarding UAT sessions before go-live.

---

## Test Environment Setup

Before starting UAT, ensure:

- [ ] BankOS UAT environment URL provided by implementation team
- [ ] Test user credentials created for each role (Branch Manager, Credit Officer, Ops Officer, Collection Agent)
- [ ] Test loan products configured (Personal Loan, Business Loan)
- [ ] Test branch set up with correct state/pincode
- [ ] Bureau mock adapter enabled (no real CIBIL calls in UAT)

**UAT Base URL:** `https://uat.bankos.yournbfc.com`
**Support Contact:** `implementation@bankos.io`

---

## MODULE 1: User Login and Role-Based Access

### TC-01: Login with Valid Credentials

**Steps:**
1. Navigate to BankOS login page
2. Enter your assigned email and password
3. If MFA is enabled, enter the OTP from authenticator app
4. Click "Login"

**Expected Result:**
- User is logged in and directed to the dashboard
- Dashboard shows metrics appropriate for user role
- Navigation menu shows only role-allowed sections

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

### TC-02: Login with Wrong Password

**Steps:**
1. Enter valid email but incorrect password
2. Click Login

**Expected Result:**
- Error message: "Invalid credentials"
- User is NOT logged in
- After 5 failed attempts, account is temporarily locked

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

### TC-03: Role-Based Access Control

**Steps:**
1. Login as Collection Agent
2. Try to navigate to Loan Origination section
3. Try to navigate to GL / Accounts section

**Expected Result:**
- Collection Agent can access: Collections, Loan details (read-only)
- Collection Agent CANNOT access: Loan Origination, Sanction, Disbursement, GL
- Unauthorized sections show "Access Denied" or are hidden from menu

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

## MODULE 2: Customer Creation

### TC-04: Create Individual Customer

**Steps:**
1. Login as Credit Officer
2. Go to Customers → Create Customer
3. Fill in:
   - Type: Individual
   - Name: Test Customer (UAT)
   - DOB: 15-Jun-1985
   - Gender: Male
   - PAN: ABCDE1234F (use test PAN for UAT)
   - Phone: 9876543210
   - Employment: Salaried
   - Monthly Income: Rs 75,000
   - KYC Status: Verified
4. Click Save

**Expected Result:**
- Customer is created with a system-generated customer number (e.g., GROWTH/CUST/000001)
- KYC status shows as "VERIFIED"
- Customer appears in the customer list

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

### TC-05: Duplicate PAN Validation

**Steps:**
1. Try to create another customer with the same PAN (ABCDE1234F)

**Expected Result:**
- System shows error: "A customer with this PAN already exists"
- Duplicate customer is NOT created

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

### TC-06: Invalid PAN Validation

**Steps:**
1. Try to create customer with PAN: "12345ABCDE" (invalid format)

**Expected Result:**
- System shows validation error: "Invalid PAN format"
- Form is NOT submitted

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

## MODULE 3: Loan Application Flow

### TC-07: Create Loan Application

**Steps:**
1. Open the customer created in TC-04
2. Click "New Application"
3. Fill in:
   - Product: Personal Loan
   - Requested Amount: Rs 5,00,000
   - Tenure: 36 months
   - Source: Branch
4. Click Submit

**Expected Result:**
- Application created with number (e.g., GROWTH/PL/2026/000001)
- Application status: LEAD
- Customer is linked to the application

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

### TC-08: Application Status Transitions

**Steps:**
1. Open the application from TC-07
2. Advance through each stage:
   - Click "Move to Application" → Status: APPLICATION
   - Click "Collect Documents" → Status: DOCUMENT_COLLECTION
   - Click "Request Bureau" → Status: BUREAU_CHECK

**Expected Result:**
- Each stage transition is recorded with timestamp and user
- Audit trail shows all transitions
- Previous status is preserved in audit log

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

## MODULE 4: Bureau Pull (CIBIL Check)

### TC-09: Initiate Bureau Pull

**Steps:**
1. Application should be in BUREAU_CHECK status
2. Click "Pull Credit Report"
3. Select Bureau: CIBIL
4. Select Type: Hard Pull
5. Confirm

**Expected Result (UAT mock):**
- Bureau request is created with status INITIATED
- Within 30 seconds, status changes to SUCCESS
- Mock bureau response shows credit score
- CIBIL score displayed (e.g., 735)

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

### TC-10: Bureau Score Display

**Steps:**
1. After successful bureau pull, view the bureau tab on the application

**Expected Result:**
- CIBIL score is displayed (e.g., 735)
- Number of active loans shown
- EMI obligations shown
- Max DPD in last 12 months shown
- Valid until date shown (30 days from pull)

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

## MODULE 5: BRE (Business Rule Engine) Evaluation

### TC-11: BRE Evaluation — Approval

**Steps:**
1. Advance application to UNDERWRITING status
2. Click "Evaluate BRE"

**Expected Result (for test customer with score 735):**
- BRE runs all configured rules
- Final Decision: APPROVED
- Approved interest rate shown (e.g., 16%)
- FOIR check passes (< 60%)
- All rules shown with PASS/FAIL status

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

### TC-12: BRE Evaluation — Rejection

**Steps:**
1. Create a new customer with PAN: QRTPK4567J (UAT test PAN for low score)
2. Create application for Rs 3,00,000
3. Pull bureau (mock will return score ~420)
4. Run BRE evaluation

**Expected Result:**
- BRE Decision: REJECTED
- Failure reasons listed:
  - Bureau score below threshold
  - Write-off found
  - DPD > 30 in last 12 months
- Application transitions to REJECTED
- Rejection reason saved

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

## MODULE 6: Sanction

### TC-13: Sanction Letter Generation

**Steps:**
1. Approved application (from TC-11)
2. Click "Sanction"
3. Confirm sanctioned amount: Rs 5,00,000
4. Confirm tenure: 36 months
5. Confirm rate: 16%
6. Click "Issue Sanction"

**Expected Result:**
- Application status → SANCTIONED
- Sanction letter PDF can be downloaded
- Sanction details (amount, rate, tenure, EMI) visible on screen
- Calculated EMI shown (approximately Rs 17,570 per month)

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

## MODULE 7: Disbursement

### TC-14: Loan Disbursement

**Steps:**
1. Sanctioned application (from TC-13)
2. Click "Disburse"
3. Enter:
   - Disbursement date: Today
   - Bank account: (test account number)
   - Mode: NEFT
4. Confirm disbursement

**Expected Result:**
- Loan is created with unique loan number (e.g., GROWTH/PL/LOAN/000001)
- Loan status: ACTIVE
- Amortization schedule generated (36 rows)
- Application status → DISBURSED
- GL entries created: DR Loan Account, CR Nostro Account

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

### TC-15: Amortization Schedule Verification

**Steps:**
1. Open the newly created loan
2. View "Repayment Schedule" tab

**Expected Result:**
- 36 schedule entries visible
- Each entry shows: Due Date, EMI, Principal, Interest, Outstanding
- First row: Opening Balance = Rs 5,00,000
- Last row: Closing Balance = Rs 0
- Sum of all principal components = Rs 5,00,000
- EMI is consistent for each row (except possibly the last)

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

## MODULE 8: Payment Processing

### TC-16: Record EMI Payment

**Steps:**
1. Open active loan (from TC-14)
2. Click "Record Payment"
3. Enter:
   - Amount: Rs 17,570 (EMI amount)
   - Payment Date: Today
   - Mode: NACH
   - Reference: NACH2026031500001
4. Save

**Expected Result:**
- Payment recorded with status SUCCESS
- First schedule entry status → PAID
- Outstanding principal decreases by principal component
- Loan overview shows updated outstanding amount

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

### TC-17: Partial Payment

**Steps:**
1. Record a payment of Rs 10,000 (less than EMI of ~Rs 17,570)

**Expected Result:**
- Payment recorded with status SUCCESS
- Schedule entry shows PARTIALLY_PAID status
- Remaining amount reflected as partial outstanding

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

### TC-18: Excess Payment (Pre-payment)

**Steps:**
1. Record a payment of Rs 1,00,000 (much more than one EMI)

**Expected Result:**
- Payment recorded
- Excess amount either reduces future EMIs or reduces principal
- Outstanding balance decreases accordingly
- System shows how excess was allocated

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

## MODULE 9: Collections

### TC-19: Overdue Detection

**Steps:**
1. Create a loan (using a test case with an EMI due 35 days ago, unpaid)
2. Run the daily batch (or trigger collection engine manually)

**Expected Result:**
- Loan shows DPD = 35
- NPA Classification: SMA_1
- Collection task automatically created (type: TELECALL)
- Loan appears in "Overdue Loans" report

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

### TC-20: Collection Task Management

**Steps:**
1. Login as Collection Agent
2. Go to Collections → My Tasks
3. Open the task created in TC-19
4. Select disposition: PTP (Promise to Pay)
5. Enter PTP date: 5 days from today
6. Enter PTP amount: Rs 17,570
7. Save

**Expected Result:**
- Task shows disposition: PTP
- PTP date and amount saved
- Task status: COMPLETED
- Follow-up task auto-created for the day after PTP date

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

### TC-21: Payment After PTP — DPD Reset

**Steps:**
1. Record payment of Rs 17,570 for the overdue loan (simulating PTP honoured)

**Expected Result:**
- Overdue amount clears
- DPD resets to 0
- NPA Classification returns to STANDARD
- Follow-up task can be marked Completed

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

## MODULE 10: Reports and Dashboards

### TC-22: Portfolio Dashboard

**Steps:**
1. Login as Branch Manager
2. View Dashboard

**Expected Result:**
- Total Active Loans count displayed
- Total Outstanding Portfolio (in Rs) displayed
- NPA % shown
- SMA breakdown (SMA-0, SMA-1, SMA-2) shown
- Today's collections vs target displayed

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

### TC-23: Overdue Aging Report

**Steps:**
1. Go to Reports → Overdue Aging

**Expected Result:**
- Report shows loans grouped by DPD bucket:
  - 1–30 DPD (SMA-0)
  - 31–60 DPD (SMA-1)
  - 61–90 DPD (SMA-2)
  - 91+ DPD (NPA)
- Amount and count shown for each bucket
- Can be exported to Excel/CSV

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

### TC-24: EMI Schedule PDF

**Steps:**
1. Open any active loan
2. Click "Download Schedule"

**Expected Result:**
- PDF downloaded with:
  - Loan number, customer name
  - All 36 rows (or tenure-length rows)
  - EMI, principal, interest, outstanding for each row
  - Totals at the bottom

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

## MODULE 11: Audit Trail

### TC-25: Audit Log Verification

**Steps:**
1. Open any loan or application
2. Click "Audit History" tab

**Expected Result:**
- All changes listed with:
  - Timestamp
  - User who made the change
  - Field changed
  - Old value and new value
- Status transitions shown
- Cannot be deleted or modified

**Pass:** [ ]  **Fail:** [ ]  **Notes:** _______________

---

## UAT Sign-Off

| Module | Status | Tester | Date |
|--------|--------|--------|------|
| 1. Login & Access | PASS / FAIL | | |
| 2. Customer Creation | PASS / FAIL | | |
| 3. Loan Application | PASS / FAIL | | |
| 4. Bureau Pull | PASS / FAIL | | |
| 5. BRE Evaluation | PASS / FAIL | | |
| 6. Sanction | PASS / FAIL | | |
| 7. Disbursement | PASS / FAIL | | |
| 8. Payment | PASS / FAIL | | |
| 9. Collections | PASS / FAIL | | |
| 10. Reports | PASS / FAIL | | |
| 11. Audit Trail | PASS / FAIL | | |

**Overall UAT Status:** PASS / FAIL

**NBFC Representative Sign-off:**
Name: _________________
Designation: _________________
Date: _________________
Signature: _________________

**BankOS Implementation Lead Sign-off:**
Name: _________________
Date: _________________
Signature: _________________

---

## Defects Raised During UAT

| # | Test Case | Description | Severity | Status |
|---|-----------|-------------|----------|--------|
| 1 | | | P1/P2/P3 | Open/Fixed |
| 2 | | | | |
| 3 | | | | |

**Severity Definitions:**
- P1 (Critical): Blocker. Cannot proceed without a fix.
- P2 (Major): Significant impact. Workaround exists.
- P3 (Minor): Cosmetic or low-impact issue.
