import { Injectable, Logger } from '@nestjs/common';
import { BureauType } from '@prisma/client';
import {
  BureauAdapterConfig,
  BureauCustomerInput,
  BureauPullResult,
  IBureauAdapter,
  Tradeline,
} from '../interfaces/bureau-adapter.interface';

/**
 * Deterministic seeded pseudo-random number generator (mulberry32).
 * Produces the same sequence for the same seed every time.
 */
function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return function (): number {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Convert a PAN string to a numeric seed.
 * Sum of char codes gives a stable integer for the same PAN.
 */
function panToSeed(pan: string): number {
  let hash = 0;
  for (let i = 0; i < pan.length; i++) {
    hash = (Math.imul(31, hash) + pan.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Return an integer in [min, max] using the provided rng.
 */
function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Return a random item from an array using the provided rng.
 */
function randItem<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Determine the credit score band based on the first character of the PAN.
 *
 * Band mapping (per spec):
 *   A-E → 720–850  (good)
 *   F-J → 650–720  (fair)
 *   K-O → 500–650  (poor)
 *   P-T → 300–500  (very poor)
 *   U-Z → -1       (no credit history)
 */
function scoreBandForPan(pan: string): {
  min: number;
  max: number;
  band: 'good' | 'fair' | 'poor' | 'very_poor' | 'no_history';
} {
  const ch = pan.charAt(0).toUpperCase();
  const code = ch.charCodeAt(0);

  if (code >= 65 && code <= 69)
    return { min: 720, max: 850, band: 'good' }; // A-E
  if (code >= 70 && code <= 74)
    return { min: 650, max: 719, band: 'fair' }; // F-J
  if (code >= 75 && code <= 79)
    return { min: 500, max: 649, band: 'poor' }; // K-O
  if (code >= 80 && code <= 84)
    return { min: 300, max: 499, band: 'very_poor' }; // P-T
  return { min: -1, max: -1, band: 'no_history' }; // U-Z
}

const LENDER_NAMES = [
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'SBI',
  'Bajaj Finance',
  'Tata Capital',
  'L&T Finance',
  'Muthoot Finance',
  'Shriram Finance',
  'HDB Financial Services',
  'Aditya Birla Finance',
  'Hero FinCorp',
  'Mahindra Finance',
];

const ACCOUNT_TYPES = [
  'PERSONAL_LOAN',
  'HOME_LOAN',
  'VEHICLE_FINANCE',
  'BUSINESS_LOAN',
  'CREDIT_CARD',
  'GOLD_LOAN',
  'LAP',
  'CONSUMER_DURABLE',
];

/**
 * Generate a list of tradelines that are correlated with the score band.
 *
 * Good scores  → more active, low DPD, lower outstanding
 * Poor scores  → possible write-offs, high DPD, more enquiries
 * No history   → empty tradelines
 */
function generateTradelines(
  rng: () => number,
  band: 'good' | 'fair' | 'poor' | 'very_poor' | 'no_history',
  nowMs: number,
): Tradeline[] {
  if (band === 'no_history') return [];

  const countMap: Record<string, [number, number]> = {
    good: [2, 5],
    fair: [2, 4],
    poor: [1, 3],
    very_poor: [1, 3],
  };

  const [minCount, maxCount] = countMap[band];
  const count = randInt(rng, minCount, maxCount);
  const tradelines: Tradeline[] = [];

  const monthMs = 30 * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const tenureMonths = randInt(rng, 12, 84);
    const openedMonthsAgo = randInt(rng, tenureMonths, tenureMonths + 36);
    const openedDate = new Date(nowMs - openedMonthsAgo * monthMs);

    const isActive = band === 'good' || band === 'fair' ? rng() < 0.7 : rng() < 0.4;

    const closedDate: Date | null = isActive
      ? null
      : new Date(openedDate.getTime() + tenureMonths * monthMs);

    const sanctionedAmountPaisa =
      randInt(rng, 50_000, 50_00_000) * 100; // 50K – 50L in paisa

    const elapsedMonths = Math.min(
      openedMonthsAgo,
      tenureMonths,
    );
    const repaidFraction = isActive ? elapsedMonths / tenureMonths : 1;
    const outstandingAmountPaisa = isActive
      ? Math.floor(sanctionedAmountPaisa * (1 - repaidFraction) * (0.8 + rng() * 0.4))
      : 0;

    const emiAmountPaisa = isActive
      ? Math.floor(sanctionedAmountPaisa / tenureMonths)
      : 0;

    // DPD correlated with score band
    let maxDpd = 0;
    let currentDpd = 0;
    let hasWriteOff = false;
    let hasSettlement = false;

    if (band === 'good') {
      maxDpd = randInt(rng, 0, 5);
      currentDpd = 0;
    } else if (band === 'fair') {
      maxDpd = randInt(rng, 0, 30);
      currentDpd = isActive ? randInt(rng, 0, 15) : 0;
    } else if (band === 'poor') {
      maxDpd = randInt(rng, 30, 90);
      currentDpd = isActive ? randInt(rng, 15, 60) : 0;
      hasWriteOff = rng() < 0.15;
    } else {
      // very_poor
      maxDpd = randInt(rng, 60, 180);
      currentDpd = isActive ? randInt(rng, 30, 120) : 0;
      hasWriteOff = rng() < 0.35;
      hasSettlement = !hasWriteOff && rng() < 0.2;
    }

    tradelines.push({
      lenderName: randItem(rng, LENDER_NAMES),
      accountType: randItem(rng, ACCOUNT_TYPES),
      sanctionedAmountPaisa,
      outstandingAmountPaisa,
      emiAmountPaisa,
      openedDate,
      closedDate,
      isActive,
      maxDpd,
      currentDpd,
      hasWriteOff,
      hasSettlement,
      tenureMonths,
    });
  }

  return tradelines;
}

/**
 * MockBureauAdapter — returns deterministic, PAN-seeded bureau data.
 *
 * The same PAN will always produce the same score and tradeline set,
 * making it safe to use in integration tests and local development.
 */
@Injectable()
export class MockBureauAdapter implements IBureauAdapter {
  private readonly logger = new Logger(MockBureauAdapter.name);

  async pull(
    customer: BureauCustomerInput,
    config: BureauAdapterConfig,
  ): Promise<BureauPullResult> {
    this.logger.log(
      `MockBureauAdapter: pulling bureau for PAN ${customer.panNumber.substring(0, 2)}***`,
    );

    // Simulate network latency (50–200 ms) without breaking determinism
    await new Promise((resolve) =>
      setTimeout(resolve, Math.floor(Math.random() * 150) + 50),
    );

    const pan = customer.panNumber.toUpperCase();
    const seed = panToSeed(pan);
    const rng = createSeededRng(seed);
    const nowMs = Date.now();

    const { min, max, band } = scoreBandForPan(pan);

    const score =
      band === 'no_history' ? -1 : randInt(rng, min, max);

    const tradelines = generateTradelines(rng, band, nowMs);

    // Aggregate statistics from tradelines
    const activeTradelines = tradelines.filter((t) => t.isActive);
    const totalActiveLoans = activeTradelines.length;

    const totalEmiObligationPaisa = activeTradelines.reduce(
      (sum, t) => sum + t.emiAmountPaisa,
      0,
    );

    const monthMs = 30 * 24 * 60 * 60 * 1000;
    const now = new Date(nowMs);

    const maxDpdLast12Months = tradelines
      .filter((t) => {
        const cutoff = new Date(nowMs - 12 * monthMs);
        return t.openedDate <= now && (t.closedDate === null || t.closedDate >= cutoff);
      })
      .reduce((m, t) => Math.max(m, t.maxDpd), 0);

    const maxDpdLast24Months = tradelines
      .filter((t) => {
        const cutoff = new Date(nowMs - 24 * monthMs);
        return t.openedDate <= now && (t.closedDate === null || t.closedDate >= cutoff);
      })
      .reduce((m, t) => Math.max(m, t.maxDpd), 0);

    const hasWriteOff = tradelines.some((t) => t.hasWriteOff);
    const hasSettlement = tradelines.some((t) => t.hasSettlement);

    // Enquiries correlated with score band
    const enquiriesLast3Months =
      band === 'good'
        ? randInt(rng, 0, 1)
        : band === 'fair'
          ? randInt(rng, 0, 2)
          : band === 'poor'
            ? randInt(rng, 1, 4)
            : band === 'very_poor'
              ? randInt(rng, 2, 6)
              : 0;

    const enquiriesLast6Months =
      enquiriesLast3Months + (band === 'no_history' ? 0 : randInt(rng, 0, 2));

    const oldestLoanAgeMonths =
      tradelines.length === 0
        ? 0
        : Math.max(
            ...tradelines.map((t) =>
              Math.floor((nowMs - t.openedDate.getTime()) / monthMs),
            ),
          );

    const pullType = config.pullType;

    const rawResponse: Record<string, unknown> = {
      source: 'MOCK',
      generatedAt: new Date(nowMs).toISOString(),
      pan: `${pan.substring(0, 2)}***${pan.charAt(9)}`,
      pullType,
      scoreVersion: '3.0',
      score,
      tradelineCount: tradelines.length,
      band,
    };

    return {
      bureauType: BureauType.CIBIL,
      score,
      totalActiveLoans,
      totalEmiObligationPaisa,
      maxDpdLast12Months,
      maxDpdLast24Months,
      enquiriesLast3Months,
      enquiriesLast6Months,
      hasWriteOff,
      hasSettlement,
      oldestLoanAgeMonths,
      tradelines,
      rawResponse,
    };
  }
}
