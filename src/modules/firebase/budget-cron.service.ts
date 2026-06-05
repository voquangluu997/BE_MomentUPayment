import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class BudgetCronService {
  private readonly logger = new Logger(BudgetCronService.name);

  // 🚀 BỔ SUNG: Danh sách ID của các huy hiệu sẽ bị khóa lại (reset) mỗi tháng
  private readonly MONTHLY_BADGES = [
    'budgetMaster',
    'topSpender',
    'savingsKing',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseAdminService: FirebaseAdminService,
    private readonly notificationService: NotificationService, // 🚀 BƠM VÀO ĐÂY
  ) {}

  /**
   * ⏰ Tự động quét ví sinh tồn vào 12:00 trưa hàng ngày (Giờ hệ thống)
   */
  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async handleSurvivalBudgetAlert() {
    this.logger.log(
      '🚀 [Moments u Payment] Tiến trình quét ví sinh tồn bắt đầu...',
    );

    try {
      const activeUsers = await this.prisma.user.findMany({
        where: {
          fcmToken: { not: null },
        },
      });

      if (!activeUsers || activeUsers.length === 0) {
        this.logger.log('ℹ️ Không tìm thấy user nào cần gửi thông báo.');
        return;
      }

      let alertCount = 0;

      for (const user of activeUsers) {
        // 🧮 Tính toán thực tế số dư ngân sách của người dùng
        const budgetStatus = await this.calculateUserBudget(user.id);

        // Nếu người dùng chưa cài đặt ngân sách (remainingPercent = 1)
        // hoặc ví an toàn (còn nhiều hơn 15%), bỏ qua không thông báo
        if (budgetStatus.remainingPercent > 0.15) {
          continue;
        }

        // 🧠 Phân loại trạng thái ví dựa theo tỷ lệ % tiền còn lại
        let messageKey: 'AM_QUY' | 'THO_OXY' | 'SAP_CAN' = 'SAP_CAN';

        if (budgetStatus.remainingPercent < 0) {
          messageKey = 'AM_QUY';
        } else if (budgetStatus.remainingPercent <= 0.1) {
          messageKey = 'THO_OXY';
        }

        // 🚀 Phát lệnh bắn thông báo đa ngôn ngữ thông minh
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

      this.logger.log(
        `✅ Hoàn thành! Đã bắn ${alertCount} thông báo đau ví đến người dùng.`,
      );
    } catch (error) {
      this.logger.error(
        '🚨 Gặp lỗi nghiêm trọng khi xử lý tiến trình Cron Job (12:00):',
        error,
      );
    }
  }

  /**
   * 🔍 Logic tính toán số dư ví thực tế dựa vào Database giao dịch
   */
  private async calculateUserBudget(
    userId: string,
  ): Promise<{ remainingPercent: number; overspentAmount: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { budgetLimit: true },
    });

    if (!user || !user.budgetLimit) {
      return { remainingPercent: 1, overspentAmount: '0' };
    }

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
      where: {
        userId,
        spentAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const totalSpent = transactions._sum.amount || 0;
    const remainingAmount = budgetLimit - totalSpent;
    const remainingPercent = remainingAmount / budgetLimit;

    let overspentAmountStr = '0';
    if (remainingAmount < 0) {
      const overspent = Math.abs(remainingAmount);
      overspentAmountStr = new Intl.NumberFormat('en-US').format(overspent);
    }

    return {
      remainingPercent,
      overspentAmount: overspentAmountStr,
    };
  }

  /**
   * ⏰ Cronjob Đa Múi Giờ: Chạy mỗi giờ vào phút số 0 (Ví dụ: 8:00, 9:00, 10:00)
   * Nhiệm vụ: Lọc ra các user đang ở đúng "9h sáng ngày mùng 1" theo múi giờ địa phương của họ
   */
  @Cron(CronExpression.EVERY_HOUR)
  async generateMonthlySummary() {
    this.logger.log(
      '🚀 Đang kiểm tra để chạy tiến trình Thống kê tháng (Theo Local Time)...',
    );

    try {
      // 1. Lấy danh sách user đang hoạt động
      const activeUsers = await this.prisma.user.findMany({
        where: { fcmToken: { not: null } },
        select: { id: true, timezone: true },
      });

      if (activeUsers.length === 0) return;

      const usersToNotify: string[] = [];

      // 2. Định dạng thời gian hiện tại dựa trên múi giờ của từng User để lọc đúng đối tượng
      for (const user of activeUsers) {
        const userTz = user.timezone || 'Asia/Ho_Chi_Minh'; // Fallback múi giờ mặc định Việt Nam

        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: userTz,
            hour: 'numeric',
            day: 'numeric',
            hour12: false,
          });

          const parts = formatter.formatToParts(new Date());
          const currentLocalDay = parseInt(
            parts.find((p) => p.type === 'day')?.value || '0',
            10,
          );
          const currentLocalHour = parseInt(
            parts.find((p) => p.type === 'hour')?.value || '0',
            10,
          );

          // Nếu đúng là ngày mùng 1 đầu tháng và đang ở khung giờ 9h00 sáng của user
          if (currentLocalDay === 1 && currentLocalHour === 9) {
            usersToNotify.push(user.id);
          }
        } catch (tzError) {
          this.logger.error(
            `Múi giờ không hợp lệ cho user ${user.id}: ${userTz}`,
            tzError,
          );
        }
      }

      // Nếu không có user nào khớp múi giờ đạt điều kiện, dừng tiến trình sớm
      if (usersToNotify.length === 0) return;

      // 3. Tính khoảng thời gian "Tháng trước" để gom dữ liệu chi tiêu
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

      // 4. Gom nhóm tổng chi tiêu tháng trước của các user được chọn
      const usersSpending = await this.prisma.transaction.groupBy({
        by: ['userId'],
        where: {
          userId: { in: usersToNotify },
          spentAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
        _sum: { amount: true },
      });

      // 5. Tính toán danh mục tốn kém nhất và gửi lệnh thông báo tích hợp
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

        const topCatName = topCategories[0]?.category || 'Khác';
        const topCatEmoji = topCategories[0]?.emoji || '💸';
        const formattedTotalSpent = new Intl.NumberFormat('en-US').format(
          totalSpent,
        );

        // ✨ GỌI DUY NHẤT HÀM NÀY: Vừa lưu In-App DB vừa bắn PUSH real-time qua Firebase
        await this.firebaseAdminService.sendLocalizedNotification(
          userId,
          'MONTHLY_SUMMARY',
          {
            month: lastMonthStr,
            total: formattedTotalSpent,
            topCategory: topCatName,
            emoji: topCatEmoji,
          },
        );
      }

      this.logger.log(
        `✅ Hoàn thành gửi thống kê tháng ${lastMonthStr} cho nhóm người dùng theo Local Time.`,
      );
    } catch (error) {
      this.logger.error(
        '🚨 Lỗi nghiêm trọng khi chạy Cronjob thống kê tháng:',
        error,
      );
    }
  }

  /**
   * ⏰ BỔ SUNG: Khởi tạo lại (Reset) huy hiệu tháng vào mùng 1 hàng tháng lúc 00:00 (Giờ hệ thống)
   * Việc dùng `deleteMany` giúp dọn dẹp hàng loạt cực kỳ nhanh mà không lo nghẽn DB.
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleMonthlyBadgeReset() {
    this.logger.log('⏰ Bắt đầu tiến trình Reset Huy Hiệu Tháng...');
    try {
      // 1. TÌM NHỮNG AI ĐANG SỞ HỮU HUY HIỆU THÁNG TRƯỚC KHI XÓA
      const usersWithBadges = await this.prisma.userBadge.findMany({
        where: { badgeId: { in: this.MONTHLY_BADGES } },
        select: { userId: true },
        distinct: ['userId'], // Lấy danh sách user duy nhất, tránh gửi trùng lặp
      });

      // 2. THỰC HIỆN XÓA HÀNG LOẠT
      const result = await this.prisma.userBadge.deleteMany({
        where: { badgeId: { in: this.MONTHLY_BADGES } },
      });

      // 3. GỬI THÔNG BÁO IN-APP CHO NHỮNG USER BỊ ẢNH HƯỞNG
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
        `✅ Hoàn tất! Đã thu hồi ${result.count} huy hiệu. Đã gửi thông báo cho ${usersWithBadges.length} users.`,
      );
    } catch (error) {
      this.logger.error('🚨 Lỗi nghiêm trọng khi reset huy hiệu tháng:', error);
    }
  }
}
