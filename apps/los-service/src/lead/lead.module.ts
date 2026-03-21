import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';

@Module({
  imports: [DatabaseModule],
  controllers: [LeadController],
  providers: [LeadService],
  exports: [LeadService],
})
export class LeadModule {}
