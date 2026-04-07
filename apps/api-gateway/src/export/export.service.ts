import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ReportsService, ReportFilter } from '../reports/reports.service';

// Paisa fields to convert to rupees on export
const PAISA_FIELDS = [
  'amountPaisa',
  'aumPaisa',
  'avgTicketPaisa',
  'outstandingPaisa',
  'disbursedPaisa',
  'collectedPaisa',
  'overduePaisa',
  'principalPaisa',
  'interestPaisa',
  'totalPaisa',
  'emiAmountPaisa',
  'sanctionedAmountPaisa',
  'requestedAmountPaisa',
  'balancePaisa',
];

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Convert an array of objects to a CSV string.
   */
  exportToCSV(data: Record<string, unknown>[], columns?: string[]): string {
    if (data.length === 0) return '';

    const flat = data.map((row) => this.flatten(row));
    const headers = columns ?? Object.keys(flat[0] ?? {});

    const escape = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = flat.map((row) =>
      headers.map((h) => escape(row[h])).join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Generate a named report and return its data as a CSV string.
   */
  async exportReport(
    orgId: string,
    reportType: string,
    filters: Omit<ReportFilter, 'orgId'>,
  ): Promise<string> {
    this.logger.log(`Exporting report "${reportType}" for org ${orgId}`);

    const filter: ReportFilter = { ...filters, orgId };
    let rawData: unknown;

    switch (reportType) {
      case 'portfolio-summary':
        rawData = await this.reportsService.portfolioSummary(filter);
        break;
      case 'disbursement':
        rawData = await this.reportsService.disbursementReport(filter);
        break;
      case 'collection':
        rawData = await this.reportsService.collectionReport(filter);
        break;
      case 'overdue':
      case 'dpd-aging':
        rawData = await this.reportsService.dpdAgingReport(filter);
        break;
      case 'npa':
        rawData = await this.reportsService.npaReport(filter);
        break;
      default:
        throw new NotFoundException(`Unknown report type: ${reportType}`);
    }

    // Normalise to array
    const rows = Array.isArray(rawData)
      ? rawData
      : Array.isArray((rawData as any)?.rows)
      ? (rawData as any).rows
      : [rawData];

    const flat = rows.map((r: any) => this.convertPaisaToRupees(this.flatten(r as Record<string, unknown>)));
    return this.exportToCSV(flat);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /** Flatten nested object into dot-notation keys. */
  private flatten(
    obj: Record<string, unknown>,
    prefix = '',
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (
        val !== null &&
        typeof val === 'object' &&
        !Array.isArray(val) &&
        !(val instanceof Date)
      ) {
        Object.assign(result, this.flatten(val as Record<string, unknown>, fullKey));
      } else if (Array.isArray(val)) {
        result[fullKey] = JSON.stringify(val);
      } else {
        result[fullKey] = val;
      }
    }
    return result;
  }

  /** Convert known paisa fields to rupees for human-readable export. */
  private convertPaisaToRupees(
    row: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(row)) {
      const baseName = key.split('.').pop() ?? key;
      if (PAISA_FIELDS.includes(baseName) && typeof val === 'number') {
        // Rename key: amountPaisa -> amountRupees
        const newKey = key.replace(/Paisa$/, 'Rupees');
        result[newKey] = val / 100;
      } else {
        result[key] = val;
      }
    }
    return result;
  }
}
