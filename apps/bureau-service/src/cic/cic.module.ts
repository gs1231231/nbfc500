import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { CicService } from './cic.service';
import { CicController } from './cic.controller';

/**
 * CicModule — encapsulates CIBIL/CIC data submission functionality.
 *
 * Provides:
 *  - CicService: generates TUEF fixed-width submission files for bureau reporting
 *  - CicController: HTTP endpoints to trigger and list submissions
 *
 * The module queries active and recently-closed loans via PrismaService
 * (made available by DatabaseModule) and builds a simplified TUEF-format file.
 */
@Module({
  imports: [DatabaseModule],
  providers: [CicService],
  controllers: [CicController],
  exports: [CicService],
})
export class CicModule {}
