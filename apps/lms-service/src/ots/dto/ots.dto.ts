export class CreateOtsProposalDto {
  loanId!: string;
  proposedAmountPaisa!: number;
  waiverAmountPaisa!: number;
  paymentPlan!: string; // LUMP_SUM / INSTALLMENTS
  installmentCount?: number;
  firstPaymentDate!: string;
  remarks?: string;
}

export class ReviewOtsProposalDto {
  decision!: string; // APPROVED / REJECTED
  reviewRemarks!: string;
  approvedAmountPaisa?: number;
}

export class RecordOtsPaymentDto {
  amountPaisa!: number;
  paymentDate!: string;
  paymentMode!: string;
  referenceNumber!: string;
  remarks?: string;
}
