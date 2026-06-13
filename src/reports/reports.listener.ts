import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter'; // 🚀 Dùng OnEvent
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ReportProcessor {
  // 🚀 Lắng nghe sự kiện 'report.generate-weekly'
  @OnEvent('report.generate-weekly', { async: true })
  async handleReport(payload: { userId: string }) {
    const { userId } = payload;
    console.log(`[Listener] Bắt đầu kết xuất CSV cho user: ${userId}...`);

    // ... (Giữ nguyên logic tạo file CSV của bạn) ...
    const mockTransactions = [
      {
        id: '1',
        amount: 50000,
        category: 'Ăn uống',
        note: 'Ăn phở sáng',
        date: '2026-05-25',
      },
      {
        id: '2',
        amount: 200000,
        category: 'Di chuyển',
        note: 'Đổ xăng ô tô',
        date: '2026-05-26',
      },
    ];

    let csvContent = '\uFEFFMã Giao Dịch,Số Tiền,Danh Mục,Ghi Chú,Ngày Tạo\n';
    mockTransactions.forEach((tx) => {
      csvContent += `"${tx.id}","${tx.amount}","${tx.category}","${tx.note}","${tx.date}"\n`;
    });

    const fileName = `report-${userId}-${Date.now()}.csv`;
    const uploadDir = path.join(__dirname, '..', '..', 'storage');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, csvContent, 'utf8');

    console.log(`[Listener] Đã xuất file thành công tại: ${filePath}`);

    // Ở đây bạn có thể gọi trực tiếp dịch vụ gửi mail/notification
  }
}
