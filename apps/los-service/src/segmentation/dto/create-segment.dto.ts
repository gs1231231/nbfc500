export class SegmentRuleDto {
  field!: string;
  operator!: string; // EQ, NEQ, GT, GTE, LT, LTE, IN, NOT_IN, BETWEEN, CONTAINS, STARTS_WITH, IS_NULL, IS_NOT_NULL
  value?: unknown;
  value2?: unknown; // for BETWEEN
}

export class CreateSegmentDto {
  segmentCode!: string;
  segmentName!: string;
  description?: string;
  segmentType!: string; // DEMOGRAPHIC, BEHAVIORAL, RISK, INCOME, PRODUCT_AFFINITY, GEOGRAPHIC, LOYALTY, CUSTOM
  priority?: number;
  isActive?: boolean;
  isAutoAssign?: boolean;
  rules!: SegmentRuleDto[];
  mappedSchemeIds?: string[];
  mappedProductIds?: string[];
  defaultLanguage?: string;
  preferredChannel?: string;
  communicationFrequency?: string;
  maxOffersToShow?: number;
  offerPriority?: string; // BEST_RATE, LOWEST_FEE, HIGHEST_CASHBACK, MANUAL
}
