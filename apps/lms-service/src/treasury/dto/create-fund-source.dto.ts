export class CreateFundSourceDto {
  sourceName!: string;           // e.g. "HDFC Bank NCD"
  sourceType!: string;           // TERM_LOAN | NCD | CP | ECB | SUBORDINATED_DEBT | EQUITY | SECURITIZATION
  sanctionedPaisa!: bigint;
  costOfFundsBps!: number;       // annual interest rate paid, in basis points
  drawdownDate?: string;
  maturityDate?: string;
  repaymentFrequency?: string;   // MONTHLY | QUARTERLY | BULLET
  covenants?: {
    minCrar?: number;
    maxNpa?: number;
    minNetWorth?: bigint;
  };
}

export class UpdateFundSourceDto {
  sourceName?: string;
  drawnPaisa?: bigint;
  outstandingPaisa?: bigint;
  costOfFundsBps?: number;
  maturityDate?: string;
  repaymentFrequency?: string;
  covenants?: {
    minCrar?: number;
    maxNpa?: number;
    minNetWorth?: bigint;
  };
  status?: string;               // ACTIVE | CLOSED | DEFAULTED
}
