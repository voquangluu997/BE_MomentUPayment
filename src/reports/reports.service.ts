import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter'; // 🚀 Dùng EventEmitter2

@Injectable()
export class ReportsService {
  constructor(private eventEmitter: EventEmitter2) {}

  async triggerReportGeneration(userId: string) {
    // 🚀 Phát sự kiện thay vì thêm vào Queue
    this.eventEmitter.emit('report.generate-weekly', { userId });

    console.log(`Đã phát sự kiện tạo báo cáo cho user: ${userId}`);
  }
}
