import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard, OrgGuard, CurrentUser, AuthenticatedUser } from '@bankos/auth';
import { RealtimeService } from './realtime.service';

@Controller('api/v1/realtime')
@UseGuards(JwtAuthGuard, OrgGuard)
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  /**
   * GET /api/v1/realtime/events
   * Server-Sent Events stream. Clients connect with EventSource.
   * Emits org-scoped events as they occur.
   *
   * Headers set:
   *   Content-Type: text/event-stream
   *   Cache-Control: no-cache
   *   Connection: keep-alive
   */
  @Get('events')
  sseStream(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx passthrough
    res.flushHeaders();

    // Send a heartbeat comment every 20s to keep the connection alive
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 20_000);

    // Subscribe to org-scoped events
    const subscription = this.realtimeService.subscribe(user.orgId).subscribe({
      next: (msgEvent) => {
        const data = (msgEvent as unknown as { data: string }).data;
        res.write(`data: ${data}\n\n`);
      },
      error: () => {
        clearInterval(heartbeat);
        res.end();
      },
    });

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      subscription.unsubscribe();
      res.end();
    });
  }

  /**
   * GET /api/v1/realtime/counters
   * Returns current live counters for the authenticated org.
   */
  @Get('counters')
  async getCounters(@CurrentUser() user: AuthenticatedUser) {
    return this.realtimeService.getLiveCounters(user.orgId);
  }
}
