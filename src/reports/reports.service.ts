import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class ReportsService {
  constructor(@InjectQueue('report-queue') private reportQueue: Queue) {}

  async triggerReportGeneration(userId: string) {
    // Thêm job vào hàng đợi với tên 'generate-weekly-report'
    await this.reportQueue.add(
      'generate-weekly-report',
      { userId },
      {
        attempts: 3, // Thử lại tối đa 3 lần nếu lỗi
        backoff: 5000, // Đợi 5 giây trước mỗi lần thử lại
      },
    );
    console.log(`Đã thêm yêu cầu báo cáo cho user: ${userId} vào hàng đợi.`);
  }
}
