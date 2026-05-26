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
  async create(userId: string, dto: CreateTransactionDto) {
    try {
      // 💡 ĐÃ SỬA: Thêm await chuẩn chỉnh trong khối try-catch
      return await this.prisma.transaction.create({
        data: {
          amount: dto.amount,
          note: dto.note,
          imageUrl: dto.imageUrl,
          category: dto.category,
          emoji: dto.emoji ?? '🌸',
          userId: userId,
        },
      });
    } catch (error) {
      this.logger.error('Failed to create transaction', error);
      throw new InternalServerErrorException(
        'Không thể lưu giao dịch hiện tại',
      );
    }
  }

  /**
   * ✨ Lấy toàn bộ lịch sử chi tiêu của riêng user đang đăng nhập
   */
  async findAllByUser(userId: string) {
    try {
      // 🛡️ BẢO MẬT: Bắt buộc phải có mệnh đề 'where: { userId }'
      // để Prisma chỉ quét các bản ghi thuộc sở hữu của chính user này
      return await this.prisma.transaction.findMany({
        where: {
          userId: userId, // Ép kiểu string chắc chắn để tránh bị nhận nhầm
        },
        orderBy: {
          spentAt: 'desc', // Sắp xếp giao dịch mới nhất lên đầu
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to fetch transactions for user ${userId}`,
        error,
      );
      throw new InternalServerErrorException(
        'Không thể tải lịch sử giao dịch của bạn',
      );
    }
  }

  /**
   * 🗑️ Xóa một giao dịch
   */
  async remove(id: number | string, userId: string) {
    // 💡 ĐÃ SỬA: Tìm kiếm động linh hoạt kiểu dữ liệu ID (Ép kiểu an toàn)
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: id as any, userId },
    });

    if (!transaction) {
      throw new NotFoundException(
        'Không tìm thấy giao dịch hoặc bạn không có quyền xóa!',
      );
    }

    if (transaction.imageUrl && transaction.imageUrl.trim() !== '') {
      try {
        await this.uploadService.deleteImage(transaction.imageUrl);
      } catch (uploadError) {
        this.logger.warn(
          'Failed to delete image from Cloudinary, continuing transaction deletion',
          uploadError,
        );
      }
    }

    return await this.prisma.transaction.delete({
      where: { id: id as any },
    });
  }

  /**
   * 📊 Lấy dữ liệu thống kê chi tiêu theo danh mục của tháng hiện tại
   */
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

    try {
      // 💡 ĐÃ SỬA: Bỏ 'as const' gây lỗi map nội bộ của PrismaClient
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
          amount: true,
        },
      });

      return groups.map((item) => ({
        category: item.category,
        emoji: item.emoji || '📝',
        totalAmount: item._sum.amount || 0,
      }));
    } catch (error) {
      this.logger.error('Failed to generate analytics', error);
      throw new InternalServerErrorException(
        'Không thể tính toán dữ liệu thống kê',
      );
    }
  }
}
