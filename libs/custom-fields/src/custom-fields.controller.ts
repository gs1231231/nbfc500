import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  JwtAuthGuard,
  OrgGuard,
  CurrentUser,
  AuthenticatedUser,
} from '@bankos/auth';
import { CustomFieldsService } from './custom-fields.service';
import { CreateFieldDto, ENTITY_TYPES, EntityType } from './dto/create-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';

@ApiTags('Custom Fields')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgGuard)
@Controller('api/v1/custom-fields')
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  // ---------------------------------------------------------------------------
  // GET /api/v1/custom-fields/form-schema?entityType=CUSTOMER
  // Must be declared BEFORE /:id to avoid route collision
  // ---------------------------------------------------------------------------

  @Get('form-schema')
  @ApiOperation({
    summary: 'Get dynamic form schema for an entity type',
    description:
      'Returns all active custom field definitions grouped by section, ' +
      'suitable for rendering a dynamic form on the frontend.',
  })
  @ApiQuery({
    name: 'entityType',
    enum: ENTITY_TYPES,
    description: 'Entity type to retrieve the form schema for',
  })
  @ApiResponse({ status: 200, description: 'Form schema returned' })
  async getFormSchema(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityType') entityType: EntityType,
  ) {
    return this.customFieldsService.getFormSchema(user.orgId, entityType);
  }

  // ---------------------------------------------------------------------------
  // POST /api/v1/custom-fields
  // ---------------------------------------------------------------------------

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a custom field definition',
    description:
      'Defines a new custom field for the tenant on a given entity type. ' +
      'The fieldKey must be unique per organization + entityType.',
  })
  @ApiResponse({ status: 201, description: 'Custom field definition created' })
  @ApiResponse({ status: 409, description: 'Field key already exists' })
  async createField(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFieldDto,
  ) {
    dto.createdBy = user.userId;
    return this.customFieldsService.defineField(user.orgId, dto);
  }

  // ---------------------------------------------------------------------------
  // GET /api/v1/custom-fields?entityType=CUSTOMER
  // ---------------------------------------------------------------------------

  @Get()
  @ApiOperation({
    summary: 'List active custom field definitions',
    description: 'Returns all active custom field definitions for the given entity type.',
  })
  @ApiQuery({
    name: 'entityType',
    enum: ENTITY_TYPES,
    description: 'Entity type to filter definitions by',
  })
  @ApiResponse({ status: 200, description: 'List of custom field definitions' })
  async listFields(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityType') entityType: EntityType,
  ) {
    return this.customFieldsService.getFieldDefinitions(user.orgId, entityType);
  }

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/custom-fields/:id
  // ---------------------------------------------------------------------------

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a custom field definition',
    description:
      'Update label, validation rules, display order, section, etc. ' +
      'The fieldKey and fieldType cannot be changed after creation.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the custom field definition' })
  @ApiResponse({ status: 200, description: 'Custom field definition updated' })
  @ApiResponse({ status: 404, description: 'Definition not found' })
  async updateField(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFieldDto,
  ) {
    dto.updatedBy = user.userId;
    return this.customFieldsService.updateField(user.orgId, id, dto);
  }

  // ---------------------------------------------------------------------------
  // DELETE /api/v1/custom-fields/:id
  // ---------------------------------------------------------------------------

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate a custom field definition',
    description:
      'Soft-deletes the field definition by setting isActive=false. ' +
      'Existing data in entity customFields is preserved.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the custom field definition' })
  @ApiResponse({ status: 200, description: 'Custom field definition deactivated' })
  @ApiResponse({ status: 404, description: 'Definition not found' })
  async deactivateField(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customFieldsService.deactivateField(user.orgId, id);
  }
}
