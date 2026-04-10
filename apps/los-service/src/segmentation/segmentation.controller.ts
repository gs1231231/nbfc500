import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
} from '@nestjs/common';
import { SegmentationService } from './segmentation.service';
import { CreateSegmentDto } from './dto/create-segment.dto';
import { UpdateSegmentDto } from './dto/update-segment.dto';
import { FilterSegmentDto } from './dto/filter-segment.dto';

@Controller('api/v1/segmentation')
export class SegmentationController {
  constructor(private readonly segmentationService: SegmentationService) {}

  /**
   * POST /api/v1/segmentation/segments
   * Create a new customer segment with rules and scheme mappings.
   */
  @Post('segments')
  createSegment(
    @Headers('x-org-id') orgId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateSegmentDto,
  ) {
    return this.segmentationService.createSegment(orgId, userId, dto);
  }

  /**
   * GET /api/v1/segmentation/segments
   * List all segments with member counts.
   */
  @Get('segments')
  listSegments(
    @Headers('x-org-id') orgId: string,
    @Query() filters: FilterSegmentDto,
  ) {
    return this.segmentationService.listSegments(orgId, filters);
  }

  /**
   * GET /api/v1/segmentation/report
   * Segment-wise report with conversion rates and disbursement volumes.
   */
  @Get('report')
  getSegmentReport(@Headers('x-org-id') orgId: string) {
    return this.segmentationService.getSegmentReport(orgId);
  }

  /**
   * GET /api/v1/segmentation/offers/:applicationId
   * Get eligible scheme offers for a loan application (LOS integration point).
   */
  @Get('offers/:applicationId')
  getEligibleOffers(
    @Headers('x-org-id') orgId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.segmentationService.getEligibleOffersForApplication(orgId, applicationId);
  }

  /**
   * POST /api/v1/segmentation/bulk-evaluate
   * Run bulk segmentation for all customers in the org (batch job).
   */
  @Post('bulk-evaluate')
  bulkSegmentCustomers(@Headers('x-org-id') orgId: string) {
    return this.segmentationService.bulkSegmentCustomers(orgId);
  }

  /**
   * GET /api/v1/segmentation/segments/:id
   * Get segment detail with members and mapped schemes.
   */
  @Get('segments/:id')
  getSegment(
    @Headers('x-org-id') orgId: string,
    @Param('id') segmentId: string,
  ) {
    return this.segmentationService.getSegment(orgId, segmentId);
  }

  /**
   * PATCH /api/v1/segmentation/segments/:id
   * Update segment rules, scheme mappings, or config.
   */
  @Patch('segments/:id')
  updateSegment(
    @Headers('x-org-id') orgId: string,
    @Param('id') segmentId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: UpdateSegmentDto,
  ) {
    return this.segmentationService.updateSegment(orgId, segmentId, userId, dto);
  }

  /**
   * DELETE /api/v1/segmentation/segments/:id
   * Deactivate a segment (soft disable).
   */
  @Delete('segments/:id')
  deactivateSegment(
    @Headers('x-org-id') orgId: string,
    @Param('id') segmentId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.segmentationService.deactivateSegment(orgId, segmentId, userId);
  }

  /**
   * POST /api/v1/segmentation/evaluate/:customerId
   * Evaluate a customer against all active segments and assign.
   */
  @Post('evaluate/:customerId')
  evaluateCustomer(
    @Headers('x-org-id') orgId: string,
    @Param('customerId') customerId: string,
    @Query('applicationId') applicationId?: string,
  ) {
    return this.segmentationService.evaluateCustomer(orgId, customerId, applicationId);
  }

  /**
   * GET /api/v1/segmentation/customers/:customerId/segments
   * Get all segments a customer belongs to.
   */
  @Get('customers/:customerId/segments')
  getCustomerSegments(
    @Headers('x-org-id') orgId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.segmentationService.getCustomerSegments(orgId, customerId);
  }

  /**
   * POST /api/v1/segmentation/segments/:id/members/:customerId
   * Manually add a customer to a segment.
   */
  @Post('segments/:id/members/:customerId')
  addToSegment(
    @Headers('x-org-id') orgId: string,
    @Param('id') segmentId: string,
    @Param('customerId') customerId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.segmentationService.addToSegment(orgId, segmentId, customerId, userId);
  }

  /**
   * DELETE /api/v1/segmentation/segments/:id/members/:customerId
   * Manually remove a customer from a segment.
   */
  @Delete('segments/:id/members/:customerId')
  removeFromSegment(
    @Headers('x-org-id') orgId: string,
    @Param('id') segmentId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.segmentationService.removeFromSegment(orgId, segmentId, customerId);
  }
}
