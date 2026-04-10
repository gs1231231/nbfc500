import { Module } from '@nestjs/common';
import { LeadScoringService } from './lead-scoring.service';
import { LeadScoringController } from './lead-scoring.controller';

@Module({
  controllers: [LeadScoringController],
  providers: [LeadScoringService],
  exports: [LeadScoringService],
})
export class LeadScoringModule {}
