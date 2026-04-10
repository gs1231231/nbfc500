import { SegmentRuleDto } from './create-segment.dto';

export class UpdateSegmentDto {
  segmentName?: string;
  description?: string;
  segmentType?: string;
  priority?: number;
  isActive?: boolean;
  isAutoAssign?: boolean;
  rules?: SegmentRuleDto[];
  mappedSchemeIds?: string[];
  mappedProductIds?: string[];
  defaultLanguage?: string;
  preferredChannel?: string;
  communicationFrequency?: string;
  maxOffersToShow?: number;
  offerPriority?: string;
}
