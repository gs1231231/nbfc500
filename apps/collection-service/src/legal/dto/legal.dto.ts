export class CreateLegalCaseDto {
  loanId!: string;
  caseType!: string; // SARFAESI / DRT / NCLT / CIVIL
  outstandingAmountPaisa!: number;
  lawyerName?: string;
  lawyerContact?: string;
  courtName?: string;
  filingDate?: string;
  remarks?: string;
}

export class UpdateLegalCaseDto {
  status?: string;
  hearingDate?: string;
  courtOrderDetails?: string;
  lawyerName?: string;
  lawyerContact?: string;
  remarks?: string;
}

export class GenerateNoticeDto {
  noticeType!: string; // SECTION_13_2 / DEMAND_NOTICE / POSSESSION_NOTICE
  servedOn?: string;
  remarks?: string;
}
