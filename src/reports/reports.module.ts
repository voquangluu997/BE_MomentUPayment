import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportProcessor } from './reports.listener';

@Module({
  // Đã gỡ bỏ hoàn toàn BullModule và BullBoardModule
  imports: [],
  providers: [ReportsService, ReportProcessor],
  exports: [ReportsService],
})
export class ReportsModule {}
