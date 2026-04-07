import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService],
})
export class PropertyModule {}
