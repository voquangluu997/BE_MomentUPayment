import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { NotificationService } from '../notifications/notification.service';

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
}
