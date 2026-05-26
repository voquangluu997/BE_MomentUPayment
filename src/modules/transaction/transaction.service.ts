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
    private uploadService: UploadService,
  ) {}

  /**
   * ✨ Tạo một giao dịch chi tiêu mới
   */
  // 💡 ĐỔI userId từ number THÀNH string
  async create(userId: string, dto: CreateTransactionDto) {
    try {
      // 💡 Nếu lỗi vẫn còn, hãy thử đổi thành: this.prisma.Transaction.create
      return await this.prisma.transaction.create({
        data: {
          amount: dto.amount,
          note: dto.note,
          imageUrl: dto.imageUrl,
          category: dto.category,
          emoji: dto.emoji ?? '🌸',
          userId: userId, // Bây giờ là chuỗi String UUID đồng bộ với DB
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
  // 💡 ĐỔI userId từ number THÀNH string
  async findAllByUser(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId: userId },
      orderBy: { spentAt: 'desc' },
    });
  }

  /**
   * 🗑️ Xóa một giao dịch
   */
  // 💡 ĐỔI userId từ number THÀNH string, id của transaction giữ là number hoặc string tùy vào schema của bạn
  async remove(id: number, userId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
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
  // 💡 ĐỔI userId từ number THÀNH string
  async getAnalytics(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const groups = await this.prisma.transaction.groupBy({
      by: ['category', 'emoji'] as const,
      where: {
        userId: userId,
        spentAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return groups.map((item) => ({
      category: item.category,
      emoji: item.emoji || '📝',
      totalAmount: item._sum.amount || 0,
    }));
  }
}
