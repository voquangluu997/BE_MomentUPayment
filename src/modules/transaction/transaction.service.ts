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
import { FirebaseAdminService } from '../firebase/firebase-admin.service';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
    private readonly firebaseService: FirebaseAdminService,
  ) {}

  /**
   * ✨ Tạo một giao dịch chi tiêu mới
   */
  async create(userId: string, dto: CreateTransactionDto) {
    try {
      var spentAt = dto.spentAt ? new Date(dto.spentAt) : new Date();
      const newTransaction = await this.prisma.transaction.create({
        data: {
          amount: dto.amount,
          note: dto.note,
          imageUrl: dto.imageUrl,
          category: dto.category,
          emoji: dto.emoji ?? '🌸',
          userId: userId,
          spentAt,
        },
      });

      await this.checkBudgetAndNotify(userId, spentAt);

      return newTransaction;
    } catch (error) {
      this.logger.error('Failed to create transaction', error);
      throw new InternalServerErrorException(
        'Không thể lưu giao dịch hiện tại',
      );
    }
  }

  /**
   * ✨ Lấy lịch sử chi tiêu kèm phân trang (Lazy Load)
   */
  async findAllByUser(userId: string, page: number = 1, limit: number = 15) {
    try {
      const skipRecords = (page - 1) * limit;

      return await this.prisma.transaction.findMany({
        where: { userId: userId },
        orderBy: { spentAt: 'desc' },
        skip: skipRecords,
        take: limit,
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
   * 📊 Lấy dữ liệu thống kê chi tiêu theo danh mục
   */
  async getAnalytics(userId: string, startDate?: string, endDate?: string) {
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    try {
      const groups = await this.prisma.transaction.groupBy({
        by: ['category'],
        where: {
          userId: userId,
          spentAt: { gte: start, lte: end },
        },
        _sum: { amount: true },
        _max: { emoji: true },
      });

      const formattedData = groups.map((item) => ({
        category: item.category,
        emoji: item._max.emoji || '📝',
        totalAmount: item._sum.amount || 0,
      }));

      return formattedData.sort((a, b) => b.totalAmount - a.totalAmount);
    } catch (error) {
      this.logger.error('Failed to generate analytics', error);
      throw new InternalServerErrorException(
        'Không thể tính toán dữ liệu thống kê',
      );
    }
  }

  /**
   * ✨ Cập nhật giao dịch
   */
  async update(id: number, userId: string, updateDto: UpdateTransactionDto) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: id, userId: userId },
    });

    if (!transaction) {
      throw new NotFoundException(
        'Giao dịch không tồn tại hoặc bạn không có quyền chỉnh sửa!',
      );
    }

    return await this.prisma.transaction.update({
      where: { id: id },
      data: {
        amount: updateDto.amount ?? transaction.amount,
        category: updateDto.category ?? transaction.category,
        note: updateDto.note ?? transaction.note,
        emoji: updateDto.emoji ?? transaction.emoji,
        imageUrl: updateDto.imageUrl ?? transaction.imageUrl,
        spentAt: updateDto.spentAt
          ? new Date(updateDto.spentAt)
          : transaction.spentAt,
      },
    });
  }

  /**
   * 🚨 Kiểm tra ngân sách và tạo thông báo chuẩn đa ngôn ngữ
   */
  private async checkBudgetAndNotify(userId: string, transactionDate: Date) {
    // ✨ GIẢI PHÁP: Kiểm tra xem transaction có thuộc tháng hiện tại không
    const now = new Date();
    const isCurrentMonth =
      transactionDate.getMonth() === now.getMonth() &&
      transactionDate.getFullYear() === now.getFullYear();

    // Nếu thêm/sửa transaction của tháng trước (hoặc tháng khác), bỏ qua không gửi thông báo
    if (!isCurrentMonth) return;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { budgetLimit: true },
    });

    if (!user || !user.budgetLimit) return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const transactionsThisMonth = await this.prisma.transaction.findMany({
      where: {
        userId,
        spentAt: { gte: startOfMonth },
      },
    });

    const totalSpent = transactionsThisMonth.reduce(
      (sum, tx) => sum + tx.amount,
      0,
    );
    const percentage = (totalSpent / user.budgetLimit) * 100;
    const roundedPercent = percentage.toFixed(0);

    // Thay thế chữ cứng thành L10n Key dùng chung
    const budgetNameKey = 'monthBudget';

    if (percentage >= 100) {
      try {
        await this.prisma.notification.create({
          data: {
            userId: userId,
            type: 'budget_100',
            titleKey: 'notiBudgetExceededTitle',
            bodyKey: 'notiBudgetExceededBody',
            arguments: [budgetNameKey, roundedPercent], // Gửi key qua Flutter
          },
        });
      } catch (err) {
        this.logger.error('Lỗi khi tạo In-App Notification (100%)', err);
      }

      await this.firebaseService.sendLocalizedNotification(userId, 'AM_QUY', {
        budgetName: budgetNameKey, // Gửi key qua FCM
        percentage: roundedPercent,
      });
    } else if (percentage >= 80) {
      try {
        await this.prisma.notification.create({
          data: {
            userId: userId,
            type: 'budget_80',
            titleKey: 'notiBudgetWarningTitle',
            bodyKey: 'notiBudgetWarningBody',
            arguments: [budgetNameKey, roundedPercent], // Gửi key qua Flutter
          },
        });
      } catch (err) {
        this.logger.error('Lỗi khi tạo In-App Notification (80%)', err);
      }

      await this.firebaseService.sendLocalizedNotification(userId, 'THO_OXY', {
        budgetName: budgetNameKey, // Gửi key qua FCM
        percentage: roundedPercent,
      });
    }
  }
}
