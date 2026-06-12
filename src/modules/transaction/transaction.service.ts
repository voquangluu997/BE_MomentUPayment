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
   * 📊 Lấy dữ liệu thống kê CHI TIẾT (Categories, Splurges, Insights)
   */
  async getAnalytics(userId: string, startDate?: string, endDate?: string) {
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    try {
      // Chạy song song 2 queries lớn để tối ưu tốc độ phản hồi
      const [groupedData, biggestSplurges] = await Promise.all([
        // 1. Lấy dữ liệu gom nhóm biểu đồ tròn
        this.prisma.transaction.groupBy({
          by: ['category'],
          where: {
            userId: userId,
            spentAt: { gte: start, lte: end },
          },
          _sum: { amount: true },
          _max: { emoji: true },
        }),

        // 2. Lấy Top 5 khoản chi lớn nhất (Đã bỏ bộ lọc bắt buộc CÓ ẢNH để giao diện dùng fallback Emoji)
        this.prisma.transaction.findMany({
          where: {
            userId: userId,
            spentAt: { gte: start, lte: end },
            // Đã xóa dòng imageUrl: { not: null... } ở đây
          },
          orderBy: { amount: 'desc' },
          take: 5,
          select: {
            id: true,
            amount: true,
            spentAt: true,
            imageUrl: true,
            category: true,
            emoji: true, // Lấy thêm trường emoji từ DB
          },
        }),
      ]);

      // Xử lý dữ liệu biểu đồ
      const formattedCategories = groupedData
        .map((item) => ({
          category: item.category,
          emoji: item._max.emoji || '📝',
          totalAmount: item._sum.amount || 0,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount);

      // Xử lý Diary Insight (Tìm danh mục chi nhiều nhất)
      let insightData = null;
      const totalPeriodSpending = formattedCategories.reduce(
        (sum, item) => sum + item.totalAmount,
        0,
      );

      if (formattedCategories.length > 0 && totalPeriodSpending > 0) {
        const topCat1 = formattedCategories[0];
        const topCat2 =
          formattedCategories.length > 1 ? formattedCategories[1] : null;

        const topAmount =
          topCat1.totalAmount + (topCat2 ? topCat2.totalAmount : 0);
        const percent = ((topAmount / totalPeriodSpending) * 100).toFixed(0);

        insightData = {
          percent: percent,
          category1: topCat1.category,
          category2: topCat2 ? topCat2.category : null,
          totalPeriodSpending: totalPeriodSpending,
        };
      }

      // Trả về Object chuẩn hóa
      return {
        categories: formattedCategories,
        biggestSplurges: biggestSplurges.map((tx) => ({
          id: tx.id.toString(),
          amount: tx.amount,
          date: tx.spentAt,
          imageUrl: tx.imageUrl,
          emoji: tx.emoji || '✨', // Ánh xạ trường emoji vào mảng trả về (có fallback)
        })),
        diaryInsight: insightData,
      };
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
   * 🚨 Kiểm tra ngân sách và tạo thông báo
   */
  private async checkBudgetAndNotify(userId: string, transactionDate: Date) {
    const now = new Date();
    const isCurrentMonth =
      transactionDate.getMonth() === now.getMonth() &&
      transactionDate.getFullYear() === now.getFullYear();

    if (!isCurrentMonth) return;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { budgetLimit: true },
    });

    if (!user || !user.budgetLimit) return;

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const transactionsThisMonth = await this.prisma.transaction.aggregate({
      where: {
        userId,
        spentAt: { gte: startOfMonth },
      },
      _sum: {
        amount: true,
      },
    });

    const totalSpent = transactionsThisMonth._sum.amount || 0;
    const percentage = (totalSpent / user.budgetLimit) * 100;
    const roundedPercent = percentage.toFixed(0);

    const budgetNameKey = 'monthBudget';

    if (percentage >= 100) {
      await this.firebaseService.sendLocalizedNotification(userId, 'AM_QUY', {
        budgetName: budgetNameKey,
        percentage: roundedPercent,
      });
    } else if (percentage >= 80) {
      await this.firebaseService.sendLocalizedNotification(userId, 'THO_OXY', {
        budgetName: budgetNameKey,
        percentage: roundedPercent,
      });
    }
  }
}
