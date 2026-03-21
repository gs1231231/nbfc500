// Loan tenure
export const MAX_LOAN_TENURE_MONTHS = 360; // 30 years
export const MIN_LOAN_TENURE_MONTHS = 3;

// Loan amounts (stored in paisa; 1 INR = 100 paisa)
export const MIN_LOAN_AMOUNT_PAISA = 1_000_000; // ₹10,000
export const MAX_LOAN_AMOUNT_PAISA = 1_000_000_000_000; // ₹10,00,00,000 (10 crore)

// Interest rates (in basis points; 1 bp = 0.01%)
export const MIN_INTEREST_RATE_BPS = 100; // 1%
export const MAX_INTEREST_RATE_BPS = 4800; // 48%

// Processing fee limits
export const MAX_PROCESSING_FEE_PERCENT = 3; // 3% of loan amount
export const GST_RATE_PERCENT = 18;

// EMI / repayment
export const EMI_GRACE_PERIOD_DAYS = 3;
export const OVERDUE_PENALTY_RATE_BPS = 200; // 2% per annum additional
export const MAX_BOUNCE_CHARGES_PAISA = 100_000; // ₹1,000

// NPA classification thresholds (days past due)
export const NPA_SUB_STANDARD_DPD = 90;
export const NPA_DOUBTFUL_DPD = 365;
export const NPA_LOSS_DPD = 730;

// KYC / identity
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const AADHAAR_REGEX = /^\d{12}$/;
export const GSTIN_REGEX =
  /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/;
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// OTP
export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 3;

// JWT
export const ACCESS_TOKEN_EXPIRY = '15m';
export const REFRESH_TOKEN_EXPIRY = '7d';

// Document upload
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
];

// Credit bureau
export const CIBIL_GOOD_SCORE_THRESHOLD = 700;
export const CIBIL_EXCELLENT_SCORE_THRESHOLD = 750;

// Cache TTLs (seconds)
export const CACHE_TTL_SHORT = 60; // 1 min
export const CACHE_TTL_MEDIUM = 300; // 5 min
export const CACHE_TTL_LONG = 3600; // 1 hour
