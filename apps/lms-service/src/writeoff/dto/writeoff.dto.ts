export class InitiateWriteoffDto {
  loanId!: string;
  reason!: string;
  outstandingPrincipalPaisa!: number;
  outstandingInterestPaisa!: number;
  provisionAmountPaisa!: number;
  remarks?: string;
}

export class ApproveWriteoffDto {
  boardResolutionNumber!: string;
  boardApprovalDate!: string;
  approvedBy!: string;
  remarks?: string;
}

export class RecordWriteoffRecoveryDto {
  recoveredAmountPaisa!: number;
  recoveryDate!: string;
  recoveryMode!: string;
  referenceNumber!: string;
  remarks?: string;
}

// ── GAP 10 additions ─────────────────────────────────────────────────────────

export class TechnicalWriteOffDto {
  outstandingPrincipalPaisa!: number;
  outstandingInterestPaisa!: number;
  provisionAmountPaisa!: number;
  reason?: string;
  remarks?: string;
}

export class BoardApprovalDto {
  boardResolutionNumber!: string;
  boardResolutionDate!: string;
  approvedBy!: string;
  meetingDate!: string;
  remarks?: string;
}

export class PostWriteOffRecoveryDto {
  amountPaisa!: number;
  recoveryDate!: string;
  recoveryMode!: string; // CASH | BANK_TRANSFER | CHEQUE | LEGAL_DECREE
  referenceNumber!: string;
  remarks?: string;
}

export class WriteOffReportFilterDto {
  fy?: string;   // e.g. 2025-26
  from?: string;
  to?: string;
}
