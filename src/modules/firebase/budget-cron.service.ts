import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseAdminService } from './firebase-admin.service';

@Injectable()
export class BudgetCronService {
  private readonly logger = new Logger(BudgetCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseAdminService: FirebaseAdminService,
  ) {}

  //* ⏰ Tự động quét ví sinh tồn vào 12:00 trưa hàng ngày.
  //* (Để test nhanh 10 giây chạy 1 lần, hãy sửa thành: @Cron('*///10 * * * * *'))

  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async handleSurvivalBudgetAlert() {
    this.logger.log(
      '🚀 [Moment u Payment] Tiến trình quét ví sinh tồn bắt đầu...',
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
        // 🧮 Hàm tính toán toán học số tiền tiêu của user (Hiện tại đang gọi hàm Mock phía dưới)
        const budgetStatus = await this.calculateUserBudget(user.id);

        // Nếu ví an toàn (còn nhiều hơn 15%), bỏ qua không thông báo
        if (budgetStatus.remainingPercent > 0.15) {
          continue;
        }

        // 🧠 Phân loại trạng thái ví dựa theo tỷ lệ % tiền còn lại giống logic cũ của bạn
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
        '🚨 Gặp lỗi nghiêm trọng khi xử lý tiến trình Cron Job:',
        error,
      );
    }
  }

  /**
   * 🔍 Logic tính toán số dư ví thực tế dựa vào Database giao dịch của bạn.
   * Hiện tại hàm đang trả về mock data để kiểm thử hệ thống.
   */
  private async calculateUserBudget(
    userId: string,
  ): Promise<{ remainingPercent: number; overspentAmount: string }> {
    const mockData = [
      { remainingPercent: 0.12, overspentAmount: '0đ' },
      { remainingPercent: 0.04, overspentAmount: '0đ' },
      { remainingPercent: -0.05, overspentAmount: '150,000đ' },
    ];

    return mockData[Math.floor(Math.random() * mockData.length)];
  }
}
