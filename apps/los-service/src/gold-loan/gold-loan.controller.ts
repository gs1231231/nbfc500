import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GoldLoanService } from './gold-loan.service';
import { AddGoldItemDto } from './dto/add-gold-item.dto';
import { AuctionGoldDto, ReleaseGoldDto, UpdateGoldRateDto } from './dto/update-gold-rate.dto';

/**
 * Controller for Gold Loan product-specific operations.
 *
 * Manages gold item custody, LTV calculation (max 75% per RBI),
 * gold release after closure, auction after NPA, and daily rate management.
 *
 * organizationId is passed via query param (TODO: replace with JWT auth).
 * All monetary amounts in responses are in both paisa and rupees.
 */
@ApiTags('Gold Loans')
@Controller('api/v1/gold-loans')
export class GoldLoanController {
  constructor(private readonly goldLoanService: GoldLoanService) {}

  // ============================================================
  // POST /api/v1/gold-loans/items
  // ============================================================

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a gold item to a loan application',
    description:
      'Registers a gold ornament/coin/bar for a gold loan application. ' +
      'Records weight, purity, hallmark, appraised value and custody details. ' +
      'Item types: CHAIN, NECKLACE, BANGLE, RING, COIN, BAR, EARRING, OTHER.',
  })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiBody({ type: AddGoldItemDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Gold item added successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid item type or validation error' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Application not found' })
  async addGoldItem(
    @Query('orgId') orgId: string,
    @Body() dto: AddGoldItemDto,
  ) {
    return this.goldLoanService.addGoldItem(orgId, dto);
  }

  // ============================================================
  // GET /api/v1/gold-loans/items/:applicationId
  // ============================================================

  @Get('items/:applicationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all gold items for an application',
    description: 'Returns all gold items registered against a loan application, ordered by item number.',
  })
  @ApiParam({ name: 'applicationId', description: 'Loan application UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of gold items' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Application not found' })
  async getItemsByApplication(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Query('orgId') orgId: string,
  ) {
    return this.goldLoanService.getItemsByApplication(orgId, applicationId);
  }

  // ============================================================
  // GET /api/v1/gold-loans/ltv/:applicationId
  // ============================================================

  @Get('ltv/:applicationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate LTV for a gold loan application',
    description:
      'Calculates Loan-to-Value ratio: (requested amount / total appraised gold value) * 100. ' +
      'Max permissible LTV per RBI guidelines is 75%. ' +
      'Returns appraised value, LTV%, and max eligible amount.',
  })
  @ApiParam({ name: 'applicationId', description: 'Loan application UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'LTV calculation result' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Application not found' })
  @ApiResponse({ status: HttpStatus.UNPROCESSABLE_ENTITY, description: 'No gold items in custody' })
  async calculateLTV(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Query('orgId') orgId: string,
  ) {
    return this.goldLoanService.calculateLTV(orgId, applicationId);
  }

  // ============================================================
  // POST /api/v1/gold-loans/release/:loanId
  // ============================================================

  @Post('release/:loanId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Release gold items after loan closure',
    description:
      'Marks all gold items in custody for a loan as RELEASED. ' +
      'Requires approvedBy (dual approval). Records custodyOutDate. ' +
      'Should be called after loan closure is confirmed.',
  })
  @ApiParam({ name: 'loanId', description: 'Loan UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiBody({ type: ReleaseGoldDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Gold released successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No gold items in custody for this loan' })
  async releaseGold(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Query('orgId') orgId: string,
    @Body() dto: ReleaseGoldDto,
  ) {
    return this.goldLoanService.releaseGold(orgId, loanId, dto);
  }

  // ============================================================
  // POST /api/v1/gold-loans/auction/:loanId
  // ============================================================

  @Post('auction/:loanId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initiate auction of gold items after NPA',
    description:
      'Marks gold items as AUCTIONED with a reserve price. ' +
      'Used after a loan becomes NPA and RBI-mandated auction process begins. ' +
      'Reserve price must be >= forced sale value.',
  })
  @ApiParam({ name: 'loanId', description: 'Loan UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiBody({ type: AuctionGoldDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Auction initiated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No gold items in custody for this loan' })
  async auctionGold(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Query('orgId') orgId: string,
    @Body() dto: AuctionGoldDto,
  ) {
    return this.goldLoanService.auctionGold(orgId, loanId, dto);
  }

  // ============================================================
  // POST /api/v1/gold-loans/rates
  // ============================================================

  @Post('rates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Update daily gold rate',
    description:
      'Records the current gold rate per 10 grams in paisa. ' +
      'Should be updated daily from MCX / IBJA rates. ' +
      'Used for LTV calculation and new appraisals.',
  })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiBody({ type: UpdateGoldRateDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Gold rate updated successfully' })
  async updateGoldRate(
    @Query('orgId') orgId: string,
    @Body() dto: UpdateGoldRateDto,
  ) {
    return this.goldLoanService.updateGoldRate(orgId, dto);
  }

  // ============================================================
  // GET /api/v1/gold-loans/rates/current
  // ============================================================

  @Get('rates/current')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get the current gold rate',
    description:
      'Returns the most recently recorded gold rate for the organization. ' +
      'Includes rate per 10 grams and per gram in both paisa and rupees.',
  })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Current gold rate' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No gold rate configured for this organization' })
  async getCurrentRate(@Query('orgId') orgId: string) {
    return this.goldLoanService.getCurrentRate(orgId);
  }
}
