import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FirebaseAdminService {
  constructor(private readonly prisma: PrismaService) {}
  private readonly logger = new Logger(FirebaseAdminService.name);

  // 🌐 Kho văn mẫu: Kết hợp cả chuỗi gửi ra màn hình khóa (FCM) & Key lưu vào In-App (DB)
  private readonly notificationDictionary = {
    AM_QUY: {
      vi: {
        title: 'Kỷ nguyên Cái Bang bắt đầu! 💸',
        body: 'Chúc mừng bạn đã quay vào ô... ÂM QUỸ! Giờ sinh tồn bằng niềm tin nhé! 🦖',
      },
      en: {
        title: 'The Beggar Era Begins! 💸',
        body: 'Congratulations, you just landed on... OVERSPENT! Time to survive on pure faith! 🦖',
      },
      inApp: {
        type: 'budget_100',
        titleKey: 'notiBudgetExceededTitle',
        bodyKey: 'notiBudgetExceededBody',
      },
    },
    THO_OXY: {
      vi: {
        title: 'Báo động đỏ: Ví thở oxy! 🚨',
        body: 'SOS! Ngân sách sắp bay màu hoàn toàn! Tối nay tính ăn mì tôm vị gì chưa bạn hiền? 🍜',
      },
      en: {
        title: 'Red Alert: Wallet on ICU! 🚨',
        body: "SOS! Your budget is almost gone! Have you decided on tonight's instant noodle flavor? 🍜",
      },
      inApp: {
        type: 'budget_80',
        titleKey: 'notiBudgetWarningTitle',
        bodyKey: 'notiBudgetWarningBody',
      },
    },
    SAP_CAN: {
      vi: {
        title: 'Ủa alo? Ví sắp cạn kìa! 👀',
        body: 'Ví thông báo: Năng lượng ví còn thấp. Đề nghị bật chế độ tiết kiệm năng lượng khẩn cấp! 🔋',
      },
      en: {
        title: 'Excuse me? Wallet is draining! 👀',
        body: 'Wallet alert: Battery low. Please enable emergency money-saving mode immediately! 🔋',
      },
      inApp: {
        type: 'budget_80',
        titleKey: 'notiBudgetWarningTitle',
        bodyKey: 'notiBudgetWarningBody',
      },
    },
    // ✨ THÊM MỚI: Dữ liệu cho tổng kết tháng
    MONTHLY_SUMMARY: {
      vi: {
        title: 'Báo cáo chi tiêu tháng {{month}} 📊',
        body: 'Tháng qua bạn tiêu hết {{total}}. {{topCategory}} {{emoji}} đang là "thủ phạm" đốt ví lớn nhất!',
      },
      en: {
        title: 'Spending Report for Month {{month}} 📊',
        body: 'You spent {{total}} last month. {{topCategory}} {{emoji}} is your biggest expense!',
      },
      inApp: {
        type: 'monthly_summary',
        titleKey: 'notiMonthlySummaryTitle',
        bodyKey: 'notiMonthlySummaryBody',
      },
    },
  };

  /**
   * 🚀 Gửi thông báo Push & Lưu In-App đồng thời
   */
  async sendLocalizedNotification(
    userId: string,
    messageKey: keyof typeof this.notificationDictionary,
    data?: {
      budgetName?: string;
      percentage?: string;
      month?: string;
      total?: string;
      topCategory?: string;
      emoji?: string;
      [key: string]: any;
    },
  ) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const dictionaryItem = this.notificationDictionary[messageKey];

    if (!dictionaryItem) {
      this.logger.error(`❌ Không tìm thấy bản dịch cho key: ${messageKey}`);
      return;
    }

    // 1. Kiểm tra spam thông báo trong ngày (chỉ áp dụng cho cảnh báo ngân sách)
    if (dictionaryItem.inApp.type.startsWith('budget')) {
      const existingNotification = await this.prisma.notification.findFirst({
        where: {
          userId,
          type: dictionaryItem.inApp.type,
          createdAt: { gte: startOfToday },
        },
      });

      if (existingNotification) {
        this.logger.log(
          `⚠️ User ${userId} đã nhận báo động ${messageKey} hôm nay. Bỏ qua để tránh spam.`,
        );
        return;
      }
    }

    // 2. Lấy thông tin user
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    // Tôn trọng cài đặt user (Tắt thông báo)
    if (
      dictionaryItem.inApp.type.startsWith('budget') &&
      user.notiBudgetAlerts === false
    ) {
      this.logger.log(
        `🤫 User ${userId} đã tắt nhận thông báo chi tiêu. Hủy lệnh gửi.`,
      );
      return;
    }

    // 3. Chuẩn bị biến động (arguments) cho App Flutter
    let args: string[] = [];
    if (messageKey === 'MONTHLY_SUMMARY') {
      args = [
        data?.month || '',
        data?.total || '0',
        data?.topCategory || '',
        data?.emoji || '',
      ];
    } else {
      args.push(data?.budgetName || 'Ví của bạn');
      args.push(data?.percentage || '80');
    }

    // ==========================================
    // 💾 LƯU DATABASE CHO IN-APP NOTIFICATION
    // ==========================================
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          type: dictionaryItem.inApp.type,
          titleKey: dictionaryItem.inApp.titleKey,
          bodyKey: dictionaryItem.inApp.bodyKey,
          arguments: args,
        },
      });
    } catch (dbError) {
      this.logger.error('❌ Lỗi khi lưu Notification vào DB:', dbError);
    }

    // ==========================================
    // 📲 BẮN PUSH NOTIFICATION (FIREBASE)
    // ==========================================
    if (!user.fcmToken) {
      this.logger.log(
        `⚠️ User ${userId} chưa có FCM Token. Đã lưu In-App thành công.`,
      );
      return;
    }

    const userLang = user.language === 'en' ? 'en' : 'vi';
    const translation = dictionaryItem[userLang];

    // ✨ Parse các biến {{key}} trong title và body thành dữ liệu thực tế
    let pushTitle = translation.title;
    let pushBody = translation.body;

    if (data) {
      for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        pushTitle = pushTitle.replace(regex, String(value));
        pushBody = pushBody.replace(regex, String(value));
      }
    }

    const payload: admin.messaging.Message = {
      token: user.fcmToken,
      notification: {
        title: pushTitle,
        body: pushBody,
      },
      data: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        ...data, // Nhét thêm data ẩn
      },
      android: {
        priority: 'high',
      },
    };

    try {
      await admin.messaging().send(payload);
      this.logger.log(
        `✅ Đã bắn PUSH [${messageKey}] bằng tiếng [${userLang}] tới User: ${userId}`,
      );
    } catch (error) {
      this.logger.error('❌ Lỗi gửi Firebase Admin SDK:', error);
    }
  }
}
