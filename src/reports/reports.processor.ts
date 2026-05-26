import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import * as fs from 'fs';
import * as path from 'path';

@Processor('report-queue')
export class ReportProcessor {
  @Process('generate-weekly-report')
  async handleReport(job: Job<{ userId: string }>) {
    const { userId } = job.data;
    console.log(`[Worker] Bắt đầu kết xuất CSV cho user: ${userId}...`);

    // 1. GIẢ LẬP LẤY DỮ LIỆU TỪ DATABASE
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
      {
        id: '3',
        amount: 1200000,
        category: 'Mua sắm',
        note: 'Mua giày mới',
        date: '2026-05-26',
      },
    ];

    // 2. TẠO NỘI DUNG FILE CSV (Dùng BOM \uFEFF để Excel không bị lỗi font Tiếng Việt)
    let csvContent = '\uFEFFMã Giao Dịch,Số Tiền,Danh Mục,Ghi Chú,Ngày Tạo\n';

    mockTransactions.forEach((tx) => {
      csvContent += `"${tx.id}","${tx.amount}","${tx.category}","${tx.note}","${tx.date}"\n`;
    });

    // 3. LƯU FILE VÀO THƯ MỤC TẠM (Hoặc upload lên AWS S3 / Cloudinary)
    const fileName = `report-${userId}-${Date.now()}.csv`;
    const uploadDir = path.join(__dirname, '..', '..', 'storage');

    // Đảm bảo thư mục storage tồn tại
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, csvContent, 'utf8');

    console.log(`[Worker] Đã xuất file thành công tại: ${filePath}`);

    // 4. TIẾP THEO: Gửi email đính kèm file hoặc gửi Firebase Notification chứa link tải file cho User ở đây.
    // Base trên hệ thống của bạn: this.mailService.sendReport(userId, filePath);
  }
}
