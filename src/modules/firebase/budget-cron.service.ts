import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter'; // 🚀 Import EventEmitter
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { NotificationService } from '../notifications/notification.service';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class BudgetCronService {
  private readonly logger = new Logger(BudgetCronService.name);

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
    private readonly eventEmitter: EventEmitter2, // 🚀 Thay Queue bằng EventEmitter
  ) {}

  private getMonthBoundaries(offsetHours: number = 7, date: Date = new Date()) {
    const localTime = new Date(date.getTime() + offsetHours * 60 * 60 * 1000);
    const year = localTime.getUTCFullYear();
    const month = localTime.getUTCMonth();

    const startOfMonth = new Date(
      Date.UTC(year, month, 1, -offsetHours, 0, 0, 0),
    );
    const endOfMonth = new Date(
      Date.UTC(year, month + 1, 0, 23 - offsetHours, 59, 59, 999),
    );

    return { startOfMonth, endOfMonth };
  }

  private getLastMonthBoundaries(
    offsetHours: number = 7,
    date: Date = new Date(),
  ) {
    const localTime = new Date(date.getTime() + offsetHours * 60 * 60 * 1000);
    const year = localTime.getUTCFullYear();
    const month = localTime.getUTCMonth();

    const startOfLastMonth = new Date(
      Date.UTC(year, month - 1, 1, -offsetHours, 0, 0, 0),
    );
    const endOfLastMonth = new Date(
      Date.UTC(year, month, 0, 23 - offsetHours, 59, 59, 999),
    );

    return { startOfLastMonth, endOfLastMonth };
  }

  /**
   * ⏰ Tự động quét ví sinh tồn vào 12:00 trưa hàng ngày - ĐÃ TỐI ƯU CỰC HẠN (CHỈ DÙNG 2 QUERIES)
   */
  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async handleSurvivalBudgetAlert() {
    this.logger.log(
      '🚀 [Moments u Payment] Tiến trình quét ví sinh tồn bắt đầu...',
    );
    try {
      // Tối ưu 1: Lấy luôn budgetLimit tại đây, loại bỏ hàm findUnique riêng lẻ trong vòng lặp
      const activeUsers = await this.prisma.user.findMany({
        where: {
          fcmToken: { not: null },
          budgetLimit: { not: null, gt: 0 },
        },
        select: { id: true, budgetLimit: true },
      });

      if (!activeUsers || activeUsers.length === 0) return;

      const userIds = activeUsers.map((u) => u.id);
      const { startOfMonth, endOfMonth } = this.getMonthBoundaries(7);

      // Tối ưu 2: Gom toàn bộ lượt truy vấn giao dịch của TẤT CẢ user thành 1 câu lệnh duy nhất (GroupBy)
      const totalSpentGroup = await this.prisma.transaction.groupBy({
        by: ['userId'],
        where: {
          userId: { in: userIds },
          spentAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      });

      // Map để tra cứu nhanh chi phí của từng user với độ phức tạp O(1)
      const spentMap = new Map<string, number>();
      for (const item of totalSpentGroup) {
        spentMap.set(item.userId, item._sum.amount || 0);
      }

      let alertCount = 0;
      for (const user of activeUsers) {
        const budgetLimit = user.budgetLimit || 0;
        const totalSpent = spentMap.get(user.id) || 0;

        const remainingAmount = budgetLimit - totalSpent;
        const remainingPercent = remainingAmount / budgetLimit;

        if (remainingPercent > 0.15) continue;

        let messageKey: 'AM_QUY' | 'THO_OXY' | 'SAP_CAN' = 'SAP_CAN';
        if (remainingPercent < 0) messageKey = 'AM_QUY';
        else if (remainingPercent <= 0.1) messageKey = 'THO_OXY';

        let overspentAmountStr = '0';
        if (remainingAmount < 0) {
          overspentAmountStr = new Intl.NumberFormat('en-US').format(
            Math.abs(remainingAmount),
          );
        }

        await this.firebaseAdminService.sendLocalizedNotification(
          user.id,
          messageKey,
          {
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            screen: 'budget_analytics',
            overspentAmount: overspentAmountStr,
          },
        );
        alertCount++;
      }
      this.logger.log(`✅ Hoàn thành! Đã bắn ${alertCount} thông báo đau ví.`);
    } catch (error) {
      this.logger.error('🚨 Lỗi Cron Job 12:00:', error);
    }
  }

  /**
   * ⏰ Cronjob Thống kê tháng (Local Time) - ĐÃ TỐI ƯU CỨU NGUY QUOTA TIÊU HAO HÀNG GIỜ
   */
  @Cron(CronExpression.EVERY_HOUR)
  async generateMonthlySummary() {
    try {
      // Danh sách các múi giờ chính toàn cầu để kiểm tra trước bằng bộ nhớ đệm CPU
      const commonTimezones = [
        'Asia/Ho_Chi_Minh',
        'Asia/Bangkok',
        'Asia/Singapore',
        'Asia/Tokyo',
        'Asia/Seoul',
        'Asia/Hong_Kong',
        'Europe/London',
        'Europe/Paris',
        'America/New_York',
        'America/Chicago',
        'America/Los_Angeles',
        'UTC',
      ];

      // Bước 1: Lọc bằng thuật toán JS xem thời điểm hiện tại có trùng vào ngày 1 lúc 9h sáng của múi giờ nào không
      const targetTimezones = commonTimezones.filter((tz) => {
        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
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
          return d === 1 && h === 9;
        } catch {
          return false;
        }
      });

      // 🔥 SIÊU TỐI ƯU: Nếu không có múi giờ nào trúng thời điểm vàng, THOÁT NGAY LẬP TỨC. Tốn đúng 0 lượt đọc DB!
      if (targetTimezones.length === 0) return;

      // Bước 2: Chỉ khi có múi giờ trùng khớp, mới vào DB quét những user thuộc múi giờ đó
      const activeUsers = await this.prisma.user.findMany({
        where: {
          fcmToken: { not: null },
          timezone: { in: targetTimezones },
        },
        select: { id: true, timezone: true },
      });

      if (activeUsers.length === 0) return;

      const usersToNotify = activeUsers.map((u) => u.id);
      const { startOfLastMonth, endOfLastMonth } =
        this.getLastMonthBoundaries(7);
      const lastMonthStr = (startOfLastMonth.getUTCMonth() + 1).toString();

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
   */
  async handleCleanupOrphanedImages() {
    this.logger.log('🧹 Bắt đầu tiến trình dọn dẹp ảnh rác trên Cloudinary...');
    try {
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

      const resources = await cloudinary.api.resources({
        type: 'upload',
        prefix: 'moment_u_payment/',
        max_results: 100,
      });

      let deleteCount = 0;
      for (const resource of resources.resources) {
        if (!usedUrls.has(resource.secure_url)) {
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
   * ⏰ Cronjob Dọn dẹp tài khoản chưa xác thực
   */
  @Cron('0 3 * * *')
  async handleCleanupUnverifiedAccounts() {
    this.logger.log(
      '🔐 Bắt đầu tiến trình kiểm tra tài khoản chưa xác thực...',
    );
    const now = new Date();

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

      if (diffDays === 28) {
        await this.sendVerificationReminder(user);
      }
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

    // 🚀 Bắn sự kiện thay vì đưa vào Queue
    this.eventEmitter.emit('mail.send-activation-email', {
      email: user.email,
      token: user.verificationToken,
      type: 'reminder',
    });

    this.logger.log(`📧 Đã phát sự kiện gửi mail nhắc nhở cho: ${user.email}`);
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
