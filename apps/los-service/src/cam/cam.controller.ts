import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CamService } from './cam.service';
import { UpdateCamDto } from './dto/update-cam.dto';

@ApiTags('Credit Appraisal Memos (CAM)')
@Controller('api/v1')
export class CamController {
  constructor(private readonly camService: CamService) {}

  private resolveOrgId(headers: Record<string, string | string[]>): string {
    const orgId = headers['x-organization-id'];
    if (!orgId || Array.isArray(orgId)) {
      throw new Error('X-Organization-Id header is required');
    }
    return orgId;
  }

  // POST /api/v1/applications/:id/generate-cam
  @Post('applications/:id/generate-cam')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Auto-generate CAM from application, customer and bureau data' })
  @ApiParam({ name: 'id', description: 'Loan application ID' })
  @ApiResponse({ status: 201, description: 'CAM generated' })
  async generateCam(
    @Headers() headers: Record<string, string>,
    @Param('id', ParseUUIDPipe) applicationId: string,
  ) {
    const orgId = this.resolveOrgId(headers);
    return this.camService.generateCam(orgId, applicationId);
  }

  // PATCH /api/v1/cams/:id
  @Patch('cams/:id')
  @ApiOperation({ summary: 'Update CAM sections (only when in DRAFT status)' })
  @ApiParam({ name: 'id', description: 'CAM ID' })
  @ApiBody({ type: UpdateCamDto })
  @ApiResponse({ status: 200, description: 'CAM updated' })
  async updateCam(
    @Headers() headers: Record<string, string>,
    @Param('id', ParseUUIDPipe) camId: string,
    @Body() dto: UpdateCamDto,
  ) {
    const orgId = this.resolveOrgId(headers);
    return this.camService.updateCam(orgId, camId, dto);
  }

  // POST /api/v1/cams/:id/approve
  @Post('cams/:id/approve')
  @ApiOperation({ summary: 'Approve a CAM (credit committee sign-off)' })
  @ApiParam({ name: 'id', description: 'CAM ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'Approver user ID' },
      },
      required: ['userId'],
    },
  })
  @ApiResponse({ status: 200, description: 'CAM approved' })
  async approveCam(
    @Headers() headers: Record<string, string>,
    @Param('id', ParseUUIDPipe) camId: string,
    @Body('userId') userId: string,
  ) {
    const orgId = this.resolveOrgId(headers);
    return this.camService.approveCam(orgId, camId, userId);
  }

  // GET /api/v1/applications/:id/cam
  @Get('applications/:id/cam')
  @ApiOperation({ summary: 'Get CAM for an application' })
  @ApiParam({ name: 'id', description: 'Loan application ID' })
  @ApiResponse({ status: 200, description: 'Credit appraisal memo' })
  async getCam(
    @Headers() headers: Record<string, string>,
    @Param('id', ParseUUIDPipe) applicationId: string,
  ) {
    const orgId = this.resolveOrgId(headers);
    return this.camService.getCam(orgId, applicationId);
  }
}
