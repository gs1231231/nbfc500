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
