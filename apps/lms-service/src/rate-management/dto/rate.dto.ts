export class UpdateBenchmarkRateDto {
  benchmark!: string;    // REPO | MCLR
  newRateBps!: number;   // new benchmark rate in basis points
  effectiveDate?: string;
}

export class RateImpactAnalysisDto {
  benchmarkChangeBps!: number; // change in basis points (positive = increase, negative = decrease)
  benchmark?: string;          // REPO | MCLR — if omitted, all floating loans are analysed
}
