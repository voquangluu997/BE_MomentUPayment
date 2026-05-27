import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UploadService } from '../upload/upload.service';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

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
   * ✨ CẬP NHẬT: Lấy lịch sử chi tiêu kèm phân trang (Lazy Load)
   */
  async findAllByUser(userId: string, page: number = 1, limit: number = 15) {
    try {
      // 🔑 Tính toán toán học số lượng record cần nhảy qua
      const skipRecords = (page - 1) * limit;

      return await this.prisma.transaction.findMany({
        where: {
          userId: userId,
        },
        orderBy: {
          spentAt: 'desc', // Sắp xếp giao dịch mới nhất lên đầu
        },
        skip: skipRecords, // 🔑 Bỏ qua các phần tử của các trang trước
        take: limit, // 🔑 Chỉ lấy đúng số lượng giới hạn của trang hiện tại
      });
    } catch (error) {
      this.logger.error(
        `Failed to fetch transactions for user ${userId} at page ${page}`,
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

  async update(id: number, userId: string, updateDto: UpdateTransactionDto) {
    // 1. Tìm xem giao dịch có tồn tại và thuộc về user này không
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: id,
        userId: userId, // Đảm bảo quyền sở hữu
      },
    });

    if (!transaction) {
      throw new NotFoundException(
        'Giao dịch không tồn tại hoặc bạn không có quyền chỉnh sửa!',
      );
    }

    // 2. Thực hiện cập nhật
    return await this.prisma.transaction.update({
      where: { id: id },
      data: {
        amount: updateDto.amount ?? transaction.amount,
        category: updateDto.category ?? transaction.category,
        note: updateDto.note ?? transaction.note,
        emoji: updateDto.emoji ?? transaction.emoji,
        imageUrl: updateDto.imageUrl ?? transaction.imageUrl,
        // Cập nhật các trường khác nếu có...
      },
    });
  }
}
