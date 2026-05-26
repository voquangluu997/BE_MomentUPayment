import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ReportsService } from './reports.service';
import { ReportProcessor } from './reports.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'report-queue',
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 50 },
    }),
    BullBoardModule.forFeature({
      name: 'report-queue',
      adapter: BullAdapter,
    }),
  ],
  providers: [ReportsService, ReportProcessor],
  exports: [ReportsService],
})
export class ReportsModule {}
