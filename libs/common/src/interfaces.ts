// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginationParams {
  /** 1-based page number (default: 1) */
  page?: number;
  /** Number of items per page (default: 20, max: 100) */
  limit?: number;
  /** Field to sort by */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ---------------------------------------------------------------------------
// API error shape
// ---------------------------------------------------------------------------

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: ApiErrorDetail[];
  traceId?: string;
  timestamp: string;
  path?: string;
}

// ---------------------------------------------------------------------------
// Generic API response wrapper
// ---------------------------------------------------------------------------

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  traceId?: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Audit / common entity fields
// ---------------------------------------------------------------------------

export interface AuditFields {
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface SoftDeleteFields extends AuditFields {
  deletedAt?: Date | null;
  deletedBy?: string | null;
  isDeleted: boolean;
}

// ---------------------------------------------------------------------------
// Money (always stored as integer paisa to avoid floating-point issues)
// ---------------------------------------------------------------------------

export interface MoneyAmount {
  /** Amount in paisa (1 INR = 100 paisa) */
  amountPaisa: number;
  currency: 'INR';
}

// ---------------------------------------------------------------------------
// Address
// ---------------------------------------------------------------------------

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  district?: string;
  state: string;
  pincode: string;
  country: string;
}

// ---------------------------------------------------------------------------
// File / document reference
// ---------------------------------------------------------------------------

export interface FileReference {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url?: string;
  uploadedAt: Date;
}

// ---------------------------------------------------------------------------
// Service health
// ---------------------------------------------------------------------------

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  uptime: number;
  timestamp: string;
  dependencies?: Record<string, 'ok' | 'down'>;
}
