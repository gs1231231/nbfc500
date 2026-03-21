/**
 * Integration Adapters - Barrel Exports
 *
 * Each adapter follows the pattern:
 *   - Interface (I<Name>Adapter)
 *   - MockAdapter (always available, safe for dev/test)
 *   - RealAdapter stub (throws NotImplemented; activated via env var)
 *   - Factory function (createXxxAdapter()) that reads env to select implementation
 *
 * Environment variable pattern:  <SERVICE>_ADAPTER=real | mock (default: mock)
 */

// ─── Prompt 31: CIBIL Bureau ───────────────────────────────────────────────────
export * from './cibil-real.adapter';

// ─── Prompt 32: Aadhaar eKYC ──────────────────────────────────────────────────
export * from './aadhaar-ekyc.adapter';

// ─── Prompt 33: PAN Verification ──────────────────────────────────────────────
export * from './pan-verification.adapter';

// ─── Prompt 34: NACH Mandate ──────────────────────────────────────────────────
export * from './nach-mandate.adapter';

// ─── Prompt 35: Disbursement Bank ─────────────────────────────────────────────
export * from './disbursement-bank.adapter';

// ─── Prompt 36: UPI Payment ───────────────────────────────────────────────────
export * from './upi-payment.adapter';

// ─── Prompt 37: SMS Gateway ───────────────────────────────────────────────────
export * from './sms-gateway.adapter';

// ─── Prompt 38: WhatsApp ──────────────────────────────────────────────────────
export * from './whatsapp.adapter';

// ─── Prompt 39: Aadhaar eSign ─────────────────────────────────────────────────
export * from './aadhaar-esign.adapter';

// ─── Prompt 40: Document Storage ──────────────────────────────────────────────
export * from './document-storage.adapter';

// ─── Prompt 41: Account Aggregator ────────────────────────────────────────────
export * from './account-aggregator.adapter';

// ─── Prompt 42: GST Portal ────────────────────────────────────────────────────
export * from './gst-portal.adapter';

// ─── Prompt 43: Vahan RTO ─────────────────────────────────────────────────────
export * from './vahan-rto.adapter';

// ─── Prompt 44: CERSAI ────────────────────────────────────────────────────────
export * from './cersai.adapter';
