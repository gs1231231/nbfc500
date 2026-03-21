import { Decimal } from 'decimal.js';

/**
 * Indian national holidays (fixed dates, year-agnostic).
 * Format: 'MM-DD'
 */
const FIXED_INDIAN_HOLIDAYS: string[] = [
  '01-26', // Republic Day
  '08-15', // Independence Day
  '10-02', // Gandhi Jayanti
  '01-01', // New Year's Day
  '05-01', // Labour Day / Maharashtra Day
  '11-01', // Kannada Rajyotsava (Karnataka) / general holiday
];

/**
 * Approximate floating Diwali / Holi dates for a range of years.
 * These are approximated since they follow lunar calendar.
 * Format: 'YYYY-MM-DD'
 */
const FLOATING_INDIAN_HOLIDAYS: string[] = [
  // Holi
  '2024-03-25',
  '2025-03-14',
  '2026-03-03',
  '2027-03-22',
  '2028-03-11',
  // Diwali (main day - Lakshmi Puja)
  '2024-11-01',
  '2025-10-20',
  '2026-11-08',
  '2027-10-29',
  '2028-10-17',
  // Eid ul-Fitr (approx)
  '2024-04-10',
  '2025-03-30',
  '2026-03-20',
  // Eid ul-Adha (approx)
  '2024-06-17',
  '2025-06-07',
  '2026-05-27',
  // Christmas
  '2024-12-25',
  '2025-12-25',
  '2026-12-25',
  '2027-12-25',
  '2028-12-25',
  // Dussehra
  '2024-10-12',
  '2025-10-02',
  '2026-10-21',
  // Ram Navami
  '2024-04-17',
  '2025-04-06',
  '2026-03-26',
];

function toDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toMonthDayKey(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

const FLOATING_HOLIDAY_SET = new Set(FLOATING_INDIAN_HOLIDAYS);

/**
 * Returns true if the given date is a business day.
 * Excludes Sundays and Indian national holidays.
 */
export function isBusinessDay(date: Date): boolean {
  // Sunday = 0
  if (date.getDay() === 0) {
    return false;
  }

  const fullKey = toDateKey(date);
  if (FLOATING_HOLIDAY_SET.has(fullKey)) {
    return false;
  }

  const mdKey = toMonthDayKey(date);
  if (FIXED_INDIAN_HOLIDAYS.includes(mdKey)) {
    return false;
  }

  return true;
}

/**
 * Returns the next business day on or after the given date.
 */
export function nextBusinessDay(date: Date): Date {
  const result = new Date(date);
  while (!isBusinessDay(result)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

/**
 * Adds a given number of months to a date, handling month-end correctly.
 * E.g. Jan 31 + 1 month = Feb 28/29 (not Mar 2/3).
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const originalDay = date.getDate();
  result.setMonth(result.getMonth() + months);

  // If the day overflowed (e.g. Jan 31 + 1 month jumped to Mar),
  // set to last day of the intended month.
  if (result.getDate() !== originalDay) {
    result.setDate(0); // last day of previous month
  }

  return result;
}

/**
 * Returns the absolute difference in days between two dates.
 * Ignores time component.
 */
export function daysBetween(date1: Date, date2: Date): number {
  const d1 = new Date(
    date1.getFullYear(),
    date1.getMonth(),
    date1.getDate(),
  );
  const d2 = new Date(
    date2.getFullYear(),
    date2.getMonth(),
    date2.getDate(),
  );
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  return new Decimal(diffMs)
    .div(1000 * 60 * 60 * 24)
    .toDecimalPlaces(0, Decimal.ROUND_FLOOR)
    .toNumber();
}
