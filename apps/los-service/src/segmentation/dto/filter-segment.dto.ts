export class FilterSegmentDto {
  segmentType?: string;
  isActive?: string; // 'true' | 'false' (query params arrive as strings)
  search?: string;
}
