import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import {
  JwtAuthGuard,
  OrgGuard,
  CurrentUser,
  AuthenticatedUser,
} from '@bankos/auth';
import { CustomerService } from './customer.service';
import { SensitiveDataInterceptor } from './customer.interceptor';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { DedupeCustomerDto } from './dto/dedupe-customer.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgGuard)
@UseInterceptors(SensitiveDataInterceptor)
@Controller('api/v1/customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  // -------------------------------------------------------------------------
  // POST /api/v1/customers
  // -------------------------------------------------------------------------

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new customer',
    description:
      'Creates a new customer for the authenticated organisation. ' +
      'At least one of PAN or Aadhaar is required. ' +
      'PAN and Aadhaar are encrypted at rest and masked in the response.',
  })
  @ApiBody({ type: CreateCustomerDto })
  @ApiResponse({ status: 201, description: 'Customer created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Duplicate customer (phone already exists)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customerService.create(user.orgId, dto, user.userId);
  }

  // -------------------------------------------------------------------------
  // GET /api/v1/customers
  // -------------------------------------------------------------------------

  @Get()
  @ApiOperation({
    summary: 'List customers with search and cursor pagination',
    description:
      'Returns a paginated list of customers. Supports full-text search on ' +
      'name, phone, and customer number. Uses cursor-based pagination.',
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search term' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page size (default 20, max 100)',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Cursor ID from previous response for next page',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of customers' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.customerService.findAll(user.orgId, {
      search,
      limit,
      cursor,
    });
  }

  // -------------------------------------------------------------------------
  // POST /api/v1/customers/dedupe
  // NOTE: must be declared before /:id to avoid route conflict
  // -------------------------------------------------------------------------

  @Post('dedupe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check for duplicate customers',
    description:
      'Checks whether a customer already exists by PAN, phone, or last 4 ' +
      'digits of Aadhaar. Returns isDuplicate flag, matched fields, and ' +
      'the existing customer ID if a match is found.',
  })
  @ApiBody({ type: DedupeCustomerDto })
  @ApiResponse({
    status: 200,
    description: 'Dedupe check result',
    schema: {
      example: {
        isDuplicate: true,
        existingCustomerId: 'uuid-here',
        matchedOn: ['pan', 'phone'],
      },
    },
  })
  dedupe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DedupeCustomerDto,
  ) {
    return this.customerService.dedupe(user.orgId, dto);
  }

  // -------------------------------------------------------------------------
  // GET /api/v1/customers/:id
  // -------------------------------------------------------------------------

  @Get(':id')
  @ApiOperation({ summary: 'Get a single customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Customer detail' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customerService.findOne(user.orgId, id);
  }

  // -------------------------------------------------------------------------
  // PATCH /api/v1/customers/:id
  // -------------------------------------------------------------------------

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a customer',
    description: 'Partial update of customer fields. Returns the updated customer.',
  })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiBody({ type: UpdateCustomerDto })
  @ApiResponse({ status: 200, description: 'Customer updated successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customerService.update(user.orgId, id, dto, user.userId);
  }

  // -------------------------------------------------------------------------
  // GET /api/v1/customers/:id/360
  // -------------------------------------------------------------------------

  @Get(':id/360')
  @ApiOperation({
    summary: 'Get 360° customer view',
    description:
      'Returns a comprehensive 360-degree view of the customer including ' +
      'KYC documents, loan applications, active loans, payment history, ' +
      'bureau pull history, collection tasks, and total relationship value.',
  })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({
    status: 200,
    description: '360° customer view',
    schema: {
      example: {
        customer: {},
        kycDocuments: [],
        loanApplications: [],
        activeLoans: [],
        payments: [],
        bureauHistory: [],
        collectionTasks: [],
        totalRelationshipValuePaisa: 0,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  get360View(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customerService.get360View(user.orgId, id);
  }
}
