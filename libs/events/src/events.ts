// ---------------------------------------------------------------------------
// Domain: Loan Application
// ---------------------------------------------------------------------------
export const APPLICATION_CREATED = 'application.created';
export const APPLICATION_SUBMITTED = 'application.submitted';
export const APPLICATION_UNDER_REVIEW = 'application.under_review';
export const APPLICATION_APPROVED = 'application.approved';
export const APPLICATION_CONDITIONALLY_APPROVED =
  'application.conditionally_approved';
export const APPLICATION_REJECTED = 'application.rejected';
export const APPLICATION_WITHDRAWN = 'application.withdrawn';
export const APPLICATION_EXPIRED = 'application.expired';
export const APPLICATION_DOCUMENTS_REQUESTED =
  'application.documents_requested';

// ---------------------------------------------------------------------------
// Domain: KYC
// ---------------------------------------------------------------------------
export const KYC_INITIATED = 'kyc.initiated';
export const KYC_DOCUMENT_UPLOADED = 'kyc.document_uploaded';
export const KYC_VERIFICATION_STARTED = 'kyc.verification_started';
export const KYC_VERIFIED = 'kyc.verified';
export const KYC_REJECTED = 'kyc.rejected';
export const KYC_EXPIRED = 'kyc.expired';

// ---------------------------------------------------------------------------
// Domain: Loan
// ---------------------------------------------------------------------------
export const LOAN_CREATED = 'loan.created';
export const LOAN_DISBURSED = 'loan.disbursed';
export const LOAN_EMI_DUE = 'loan.emi_due';
export const LOAN_OVERDUE = 'loan.overdue';
export const LOAN_NPA_CLASSIFIED = 'loan.npa_classified';
export const LOAN_CLOSED = 'loan.closed';
export const LOAN_FORECLOSED = 'loan.foreclosed';
export const LOAN_WRITTEN_OFF = 'loan.written_off';
export const LOAN_RESTRUCTURED = 'loan.restructured';
export const LOAN_NOC_ISSUED = 'loan.noc_issued';

// ---------------------------------------------------------------------------
// Domain: Payment / Repayment
// ---------------------------------------------------------------------------
export const PAYMENT_INITIATED = 'payment.initiated';
export const PAYMENT_RECEIVED = 'payment.received';
export const PAYMENT_FAILED = 'payment.failed';
export const PAYMENT_REVERSED = 'payment.reversed';
export const PAYMENT_BOUNCED = 'payment.bounced';
export const PAYMENT_PARTIALLY_RECEIVED = 'payment.partially_received';
export const NACH_MANDATE_REGISTERED = 'payment.nach_mandate_registered';
export const NACH_MANDATE_CANCELLED = 'payment.nach_mandate_cancelled';
export const UPI_AUTOPAY_REGISTERED = 'payment.upi_autopay_registered';
export const UPI_AUTOPAY_CANCELLED = 'payment.upi_autopay_cancelled';

// ---------------------------------------------------------------------------
// Domain: Collections
// ---------------------------------------------------------------------------
export const COLLECTION_ASSIGNED = 'collection.assigned';
export const COLLECTION_NOTICE_SENT = 'collection.notice_sent';
export const COLLECTION_LEGAL_INITIATED = 'collection.legal_initiated';
export const COLLECTION_SETTLED = 'collection.settled';
export const COLLECTION_WAIVER_APPROVED = 'collection.waiver_approved';

// ---------------------------------------------------------------------------
// Domain: User / Customer
// ---------------------------------------------------------------------------
export const USER_REGISTERED = 'user.registered';
export const USER_PROFILE_UPDATED = 'user.profile_updated';
export const USER_OTP_REQUESTED = 'user.otp_requested';
export const USER_OTP_VERIFIED = 'user.otp_verified';
export const USER_PASSWORD_CHANGED = 'user.password_changed';
export const USER_ACCOUNT_LOCKED = 'user.account_locked';
export const USER_ACCOUNT_UNLOCKED = 'user.account_unlocked';

// ---------------------------------------------------------------------------
// Domain: Notifications
// ---------------------------------------------------------------------------
export const NOTIFICATION_SEND_SMS = 'notification.send_sms';
export const NOTIFICATION_SEND_EMAIL = 'notification.send_email';
export const NOTIFICATION_SEND_PUSH = 'notification.send_push';
export const NOTIFICATION_SEND_WHATSAPP = 'notification.send_whatsapp';
export const NOTIFICATION_DELIVERED = 'notification.delivered';
export const NOTIFICATION_FAILED = 'notification.failed';

// ---------------------------------------------------------------------------
// Domain: Credit Bureau
// ---------------------------------------------------------------------------
export const CREDIT_REPORT_REQUESTED = 'credit.report_requested';
export const CREDIT_REPORT_RECEIVED = 'credit.report_received';
export const CREDIT_REPORT_FAILED = 'credit.report_failed';
