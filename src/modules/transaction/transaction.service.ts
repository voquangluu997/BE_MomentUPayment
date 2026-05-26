import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService, // Khai báo trong constructor
  ) {}
  /**
   * ✨ Tạo một giao dịch chi tiêu mới
   */
  async create(userId: number, dto: CreateTransactionDto) {
    try {
      return await this.prisma.transaction.create({
        data: {
          amount: dto.amount,
          note: dto.note,
          imageUrl: dto.imageUrl,
          category: dto.category,
          emoji: dto.emoji ?? '🌸', // Nếu không gửi emoji, mặc định tặng bông hoa pastel
          userId: userId,
        },
      });
    } catch (error) {
      this.logger.error('Failed to create transaction', error as any);
      throw new InternalServerErrorException(
        'Không thể lưu giao dịch hiện tại',
      );
    }
  }

  /**
   * ✨ Lấy toàn bộ lịch sử chi tiêu của riêng user đang đăng nhập
   */
  async findAllByUser(userId: number) {
    return this.prisma.transaction.findMany({
      where: { userId: userId },
      orderBy: { spentAt: 'desc' }, // Giao dịch mới nhất xếp lên đầu
    });
  }

  /**
   * 🗑️ Xóa một giao dịch (Bổ sung để người dùng có thể sửa sai)
   */
  async remove(id: number, userId: number) {
    // ✨ Đổi string thành number ở đây
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId }, // Hết lỗi gạch đỏ vì cả 2 vế đã là number đồng bộ với Prisma
    });

    if (!transaction) {
      throw new NotFoundException(
        'Không tìm thấy giao dịch hoặc bạn không có quyền xóa!',
      );
    }

    if (transaction.imageUrl && transaction.imageUrl.trim() !== '') {
      await this.uploadService.deleteImage(transaction.imageUrl);
    }

    return this.prisma.transaction.delete({
      where: { id },
    });
  }

  /**
   * 📊 Lấy dữ liệu thống kê chi tiêu theo danh mục của tháng hiện tại
   */
  async getAnalytics(userId: number) {
    const now = new Date();
    // 📅 Xác định ngày đầu tháng (Ví dụ: 2026-05-01T00:00:00.000Z)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    // 📅 Xác định ngày cuối tháng (Ví dụ: 2026-05-31T23:59:59.999Z)
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    // 🧠 Sử dụng tính năng groupBy của Prisma để gom nhóm dữ liệu siêu tốc từ Postgres
    const groups = await this.prisma.transaction.groupBy({
      by: ['category', 'emoji'],
      where: {
        userId: userId,
        spentAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: {
        amount: true, // Cộng tổng số tiền của từng nhóm
      },
    });

    // Định dạng lại cấu trúc JSON trả về cho Mobile dễ xử lý
    return groups.map((item) => ({
      category: item.category,
      emoji: item.emoji || '📝',
      totalAmount: item._sum.amount || 0,
    }));
  }
}
