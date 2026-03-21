import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
