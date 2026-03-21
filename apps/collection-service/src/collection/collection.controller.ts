import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CollectionService } from './collection.service';
import { ListTasksDto } from './dto/list-tasks.dto';
import { UpdateDispositionDto } from './dto/update-disposition.dto';

@Controller('api/v1/collections')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  /**
   * GET /api/v1/collections/tasks
   *
   * Lists collection tasks with optional filters.
   * Query params: status, assignedToId, loanId, page, limit
   */
  @Get('tasks')
  async listTasks(@Query() query: ListTasksDto) {
    return this.collectionService.listTasks(query);
  }

  /**
   * POST /api/v1/collections/tasks/:id/disposition
   *
   * Records a disposition (outcome) against a collection task.
   * Body: { disposition, ptpDate?, ptpAmountPaisa?, remarks? }
   */
  @Post('tasks/:id/disposition')
  @HttpCode(HttpStatus.OK)
  async updateDisposition(
    @Param('id') taskId: string,
    @Body() dto: UpdateDispositionDto,
  ) {
    return this.collectionService.updateDisposition(taskId, dto);
  }

  /**
   * GET /api/v1/collections/dashboard
   *
   * Returns overdue summary with DPD buckets and collection efficiency.
   * Query param: orgId (required)
   */
  @Get('dashboard')
  async getDashboard(@Query('orgId') orgId: string) {
    return this.collectionService.getDashboard(orgId);
  }
}
