import {
  Controller,
  Get,
  Query,
  Headers,
} from '@nestjs/common';
import { ReportsService, ReportFilter } from './reports.service';

@Controller('api/v1/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private buildFilter(
    orgId: string,
    from?: string,
    to?: string,
    productId?: string,
    branchId?: string,
    dsaId?: string,
  ): ReportFilter {
    return { orgId, from, to, productId, branchId, dsaId };
  }

  /** GET /api/v1/reports/portfolio-summary */
  @Get('portfolio-summary')
  portfolioSummary(
    @Headers('x-org-id') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('productId') productId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.portfolioSummary(
      this.buildFilter(orgId, from, to, productId, branchId),
    );
  }

  /** GET /api/v1/reports/disbursement */
  @Get('disbursement')
  disbursementReport(
    @Headers('x-org-id') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('productId') productId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.disbursementReport(
      this.buildFilter(orgId, from, to, productId, branchId),
    );
  }

  /** GET /api/v1/reports/collection */
  @Get('collection')
  collectionReport(
    @Headers('x-org-id') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('productId') productId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.collectionReport(
      this.buildFilter(orgId, from, to, productId, branchId),
    );
  }

  /** GET /api/v1/reports/dpd-aging */
  @Get('dpd-aging')
  dpdAgingReport(
    @Headers('x-org-id') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.dpdAgingReport(
      this.buildFilter(orgId, from, to, undefined, branchId),
    );
  }

  /** GET /api/v1/reports/npa */
  @Get('npa')
  npaReport(
    @Headers('x-org-id') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.npaReport(
      this.buildFilter(orgId, from, to, undefined, branchId),
    );
  }

  /** GET /api/v1/reports/provision */
  @Get('provision')
  provisionReport(
    @Headers('x-org-id') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.provisionReport(this.buildFilter(orgId, from, to));
  }

  /** GET /api/v1/reports/bounce */
  @Get('bounce')
  bounceReport(
    @Headers('x-org-id') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.bounceReport(
      this.buildFilter(orgId, from, to, undefined, branchId),
    );
  }

  /** GET /api/v1/reports/dsa-performance */
  @Get('dsa-performance')
  dsaPerformanceReport(
    @Headers('x-org-id') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dsaId') dsaId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.dsaPerformanceReport(
      this.buildFilter(orgId, from, to, undefined, branchId, dsaId),
    );
  }

  /** GET /api/v1/reports/branch-performance */
  @Get('branch-performance')
  branchPerformanceReport(
    @Headers('x-org-id') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.branchPerformanceReport(this.buildFilter(orgId, from, to));
  }

  /** GET /api/v1/reports/product-pnl */
  @Get('product-pnl')
  productPnlReport(
    @Headers('x-org-id') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('productId') productId?: string,
  ) {
    return this.reportsService.productPnlReport(
      this.buildFilter(orgId, from, to, productId),
    );
  }

  /** GET /api/v1/reports/top-borrower-exposure */
  @Get('top-borrower-exposure')
  topBorrowerExposureReport(@Headers('x-org-id') orgId: string) {
    return this.reportsService.topBorrowerExposureReport({ orgId });
  }

  /** GET /api/v1/reports/sector-concentration */
  @Get('sector-concentration')
  sectorConcentrationReport(@Headers('x-org-id') orgId: string) {
    return this.reportsService.sectorConcentrationReport({ orgId });
  }

  /** GET /api/v1/reports/geographic-concentration */
  @Get('geographic-concentration')
  geographicConcentrationReport(@Headers('x-org-id') orgId: string) {
    return this.reportsService.geographicConcentrationReport({ orgId });
  }

  /** GET /api/v1/reports/yield-analysis */
  @Get('yield-analysis')
  yieldAnalysisReport(@Headers('x-org-id') orgId: string) {
    return this.reportsService.yieldAnalysisReport({ orgId });
  }

  /** GET /api/v1/reports/restructured-book */
  @Get('restructured-book')
  restructuredBookReport(
    @Headers('x-org-id') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.restructuredBookReport(this.buildFilter(orgId, from, to));
  }

  /** GET /api/v1/reports/write-off-recovery */
  @Get('write-off-recovery')
  writeOffRecoveryReport(
    @Headers('x-org-id') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.writeOffRecoveryReport(this.buildFilter(orgId, from, to));
  }

  /** GET /api/v1/reports/insurance-renewal */
  @Get('insurance-renewal')
  insuranceRenewalReport(@Headers('x-org-id') orgId: string) {
    return this.reportsService.insuranceRenewalReport({ orgId });
  }

  /** GET /api/v1/reports/nach-bounce-trend */
  @Get('nach-bounce-trend')
  nachBounceTrendReport(
    @Headers('x-org-id') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.nachBounceTrendReport(this.buildFilter(orgId, from, to));
  }

  /** GET /api/v1/reports/sma */
  @Get('sma')
  smaReport(
    @Headers('x-org-id') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.smaReport(this.buildFilter(orgId, from, to));
  }

  /** GET /api/v1/reports/tat */
  @Get('tat')
  tatReport(
    @Headers('x-org-id') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('productId') productId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.tatReport(
      this.buildFilter(orgId, from, to, productId, branchId),
    );
  }
}
