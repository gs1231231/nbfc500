export class InitiateBalanceTransferDto {
  customerId!: string;
  productId!: string;
  branchId!: string;
  sourceLender!: string;           // name of current lender
  currentOutstandingPaisa!: number; // outstanding principal at source lender
  foreclosureAmountPaisa!: number;  // amount required to close the loan at source
  currentRateBps!: number;         // interest rate at source lender (bps)
  currentTenureRemainingMonths!: number;
  currentEmiPaisa!: number;

  // Proposed terms with the organization
  proposedRateBps!: number;
  proposedTenureMonths!: number;
  topUpAmountPaisa?: number;        // optional top-up over and above BT amount
  remarks?: string;
}

export class CalculateSavingsDto {
  currentOutstandingPaisa!: number;
  currentRateBps!: number;
  currentTenureRemainingMonths!: number;
  currentEmiPaisa!: number;

  proposedRateBps!: number;
  proposedTenureMonths!: number;
  foreclosureAmountPaisa!: number;
  processingFeePercent?: number;    // defaults to 0 if not specified
}

export class TopUpLoanDto {
  topUpAmountPaisa!: number;
  topUpRateBps?: number;             // if omitted, uses existing loan rate
  topUpTenureMonths?: number;        // if omitted, uses remaining tenure
  remarks?: string;
}
