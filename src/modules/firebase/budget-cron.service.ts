import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { NotificationService } from '../notifications/notification.service';
import { v2 as cloudinary } from 'cloudinary';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class BudgetCronService {
  private readonly logger = new Logger(BudgetCronService.name);

  // 🚀 CẬP NHẬT: Danh sách đầy đủ các huy hiệu định kỳ hàng tháng cần reset
  private readonly MONTHLY_BADGES = [
    'budgetMaster',
    'topSpender',
    'savingsKing',
    'nightOwl',
    'paydayFlash',
    'foodDestroyer',
    'weekendStorm',
    'goldfish',
    'brokeAF',
    'bigTicket',
    'balanced',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseAdminService: FirebaseAdminService,
    private readonly notificationService: NotificationService,
    @InjectQueue('mail-queue') private mailQueue: Queue,
  ) {}

  /**
   * ⏰ Tự động quét ví sinh tồn vào 12:00 trưa hàng ngày
   */
  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async handleSurvivalBudgetAlert() {
    this.logger.log(
      '🚀 [Moments u Payment] Tiến trình quét ví sinh tồn bắt đầu...',
    );
    try {
      const activeUsers = await this.prisma.user.findMany({
        where: { fcmToken: { not: null } },
      });

      if (!activeUsers || activeUsers.length === 0) return;

      let alertCount = 0;
      for (const user of activeUsers) {
        const budgetStatus = await this.calculateUserBudget(user.id);
        if (budgetStatus.remainingPercent > 0.15) continue;

        let messageKey: 'AM_QUY' | 'THO_OXY' | 'SAP_CAN' = 'SAP_CAN';
        if (budgetStatus.remainingPercent < 0) messageKey = 'AM_QUY';
        else if (budgetStatus.remainingPercent <= 0.1) messageKey = 'THO_OXY';

        await this.firebaseAdminService.sendLocalizedNotification(
          user.id,
          messageKey,
          {
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            screen: 'budget_analytics',
            overspentAmount: budgetStatus.overspentAmount,
          },
        );
        alertCount++;
      }
      this.logger.log(`✅ Hoàn thành! Đã bắn ${alertCount} thông báo đau ví.`);
    } catch (error) {
      this.logger.error('🚨 Lỗi Cron Job 12:00:', error);
    }
  }

  private async calculateUserBudget(
    userId: string,
  ): Promise<{ remainingPercent: number; overspentAmount: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { budgetLimit: true },
    });

    if (!user || !user.budgetLimit)
      return { remainingPercent: 1, overspentAmount: '0' };

    const budgetLimit = user.budgetLimit;
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

    const transactions = await this.prisma.transaction.aggregate({
      where: { userId, spentAt: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true },
    });

    const totalSpent = transactions._sum.amount || 0;
    const remainingAmount = budgetLimit - totalSpent;
    const remainingPercent = remainingAmount / budgetLimit;

    let overspentAmountStr = '0';
    if (remainingAmount < 0) {
      overspentAmountStr = new Intl.NumberFormat('en-US').format(
        Math.abs(remainingAmount),
      );
    }

    return { remainingPercent, overspentAmount: overspentAmountStr };
  }

  /**
   * ⏰ Cronjob Thống kê tháng (Local Time)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async generateMonthlySummary() {
    try {
      const activeUsers = await this.prisma.user.findMany({
        where: { fcmToken: { not: null } },
        select: { id: true, timezone: true },
      });

      const usersToNotify: string[] = [];
      for (const user of activeUsers) {
        const userTz = user.timezone || 'Asia/Ho_Chi_Minh';
        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: userTz,
            hour: 'numeric',
            day: 'numeric',
            hour12: false,
          });
          const parts = formatter.formatToParts(new Date());
          const d = parseInt(
            parts.find((p) => p.type === 'day')?.value || '0',
            10,
          );
          const h = parseInt(
            parts.find((p) => p.type === 'hour')?.value || '0',
            10,
          );
          if (d === 1 && h === 9) usersToNotify.push(user.id);
        } catch (e) {}
      }

      if (usersToNotify.length === 0) return;

      const now = new Date();
      const startOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      );
      const endOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );
      const lastMonthStr = (startOfLastMonth.getMonth() + 1).toString();

      const usersSpending = await this.prisma.transaction.groupBy({
        by: ['userId'],
        where: {
          userId: { in: usersToNotify },
          spentAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { amount: true },
      });

      for (const userStats of usersSpending) {
        const userId = userStats.userId;
        const totalSpent = userStats._sum.amount || 0;
        if (totalSpent <= 0) continue;

        const topCategories = await this.prisma.transaction.groupBy({
          by: ['category', 'emoji'],
          where: {
            userId,
            spentAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          },
          _sum: { amount: true },
          orderBy: { _sum: { amount: 'desc' } },
          take: 1,
        });

        await this.firebaseAdminService.sendLocalizedNotification(
          userId,
          'MONTHLY_SUMMARY',
          {
            month: lastMonthStr,
            total: new Intl.NumberFormat('en-US').format(totalSpent),
            topCategory: topCategories[0]?.category || 'Khác',
            emoji: topCategories[0]?.emoji || '💸',
          },
        );
      }
    } catch (error) {
      this.logger.error('🚨 Lỗi Cronjob thống kê tháng:', error);
    }
  }

  /**
   * ⏰ Reset Huy Hiệu Tháng
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleMonthlyBadgeReset() {
    this.logger.log('⏰ Bắt đầu tiến trình Reset Huy Hiệu Tháng...');
    try {
      const usersWithBadges = await this.prisma.userBadge.findMany({
        where: { badgeId: { in: this.MONTHLY_BADGES } },
        select: { userId: true },
        distinct: ['userId'],
      });

      await this.prisma.userBadge.deleteMany({
        where: { badgeId: { in: this.MONTHLY_BADGES } },
      });

      for (const user of usersWithBadges) {
        await this.notificationService.createNotification({
          userId: user.userId,
          type: 'badge_reset',
          titleKey: 'NOTI_BADGE_RESET_TITLE',
          bodyKey: 'NOTI_BADGE_RESET_BODY',
          arguments: [],
        });
      }
      this.logger.log(
        `✅ Đã reset huy hiệu cho ${usersWithBadges.length} user.`,
      );
    } catch (error) {
      this.logger.error('🚨 Lỗi reset huy hiệu tháng:', error);
    }
  }

  /**
   * 🧹 TỰ ĐỘNG DỌN DẸP ẢNH RÁC (Orphaned Images)
   * Chạy lúc 2 giờ sáng hàng ngày
   */
  // @Cron('0 2 * * *')
  async handleCleanupOrphanedImages() {
    this.logger.log('🧹 Bắt đầu tiến trình dọn dẹp ảnh rác trên Cloudinary...');
    try {
      // 1. Lấy danh sách tất cả URL ảnh đang có trong database (trong 7 ngày gần đây)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const usedTransactions = await this.prisma.transaction.findMany({
        where: {
          imageUrl: { not: null },
          spentAt: { gte: sevenDaysAgo },
        },
        select: { imageUrl: true },
      });

      const usedUrls = new Set(usedTransactions.map((t) => t.imageUrl));

      // 2. Lấy danh sách ảnh từ Cloudinary (theo folder đã định nghĩa)
      // Lưu ý: Cần cấu hình Cloudinary Search API hoặc list resources
      const resources = await cloudinary.api.resources({
        type: 'upload',
        prefix: 'moment_u_payment/', // Thư mục của app
        max_results: 100,
      });

      let deleteCount = 0;
      for (const resource of resources.resources) {
        // Kiểm tra xem ảnh trên Cloud có nằm trong list ảnh đang sử dụng không
        if (!usedUrls.has(resource.secure_url)) {
          // 3. Xóa ảnh không sử dụng
          await cloudinary.uploader.destroy(resource.public_id);
          this.logger.log(`🗑️ Đã xóa ảnh rác: ${resource.public_id}`);
          deleteCount++;
        }
      }

      this.logger.log(`✅ Hoàn thành dọn dẹp. Đã xóa ${deleteCount} ảnh rác.`);
    } catch (error) {
      this.logger.error('🚨 Lỗi Cronjob dọn dẹp ảnh:', error);
    }
  }

  /**
   * ⏰ Cronjob Dọn dẹp tài khoản chưa xác thực (Chạy 3h sáng hàng ngày)
   */
  @Cron('0 3 * * *')
  async handleCleanupUnverifiedAccounts() {
    this.logger.log(
      '🔐 Bắt đầu tiến trình kiểm tra tài khoản chưa xác thực...',
    );
    const now = new Date();

    // Tìm các user chưa xác thực
    const unverifiedUsers = await this.prisma.user.findMany({
      where: { isEmailVerified: false },
      select: {
        id: true,
        email: true,
        createdAt: true,
        language: true,
        verificationToken: true,
      },
    });

    for (const user of unverifiedUsers) {
      const diffTime = Math.abs(now.getTime() - user.createdAt.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // 1. Nhắc nhở trước 48h (tức là sau 28 ngày)
      if (diffDays === 28) {
        await this.sendVerificationReminder(user);
      }

      // 2. Xóa tài khoản sau 30 ngày
      if (diffDays >= 30) {
        await this.deleteUnverifiedAccount(user);
      }
    }
  }

  private async sendVerificationReminder(user: {
    email: string;
    verificationToken: string | null;
  }) {
    if (!user.verificationToken) {
      this.logger.warn(
        `⚠️ Bỏ qua gửi mail nhắc nhở cho ${user.email} do thiếu token xác thực.`,
      );
      return;
    }

    await this.mailQueue.add('send-activation-email', {
      email: user.email,
      token: user.verificationToken,
      type: 'reminder',
    });
    this.logger.log(
      `📧 Đã thêm job gửi mail nhắc nhở vào queue cho: ${user.email}`,
    );
  }

  private async deleteUnverifiedAccount(user: { id: string; email: string }) {
    try {
      await this.prisma.user.delete({ where: { id: user.id } });
      this.logger.log(`🗑️ Đã xóa tài khoản chưa xác thực: ${user.email}`);
    } catch (error) {
      this.logger.error(`🚨 Lỗi xóa user ${user.id}:`, error);
    }
  }
}
