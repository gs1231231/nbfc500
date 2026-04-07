import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiEndpoint(summary: string, status = 200) {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiResponse({ status, description: 'Success' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
    ApiResponse({ status: 404, description: 'Not Found' }),
  );
}
