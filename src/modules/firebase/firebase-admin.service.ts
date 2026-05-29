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
      // Thông tin để lưu vào Database cho app Flutter tự dịch
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
  };

  /**
   * 🚀 Gửi thông báo Push & Lưu In-App đồng thời
   */
  async sendLocalizedNotification(
    userId: string,
    messageKey: keyof typeof this.notificationDictionary,
    data?: { budgetName?: string; percentage?: string; [key: string]: any }, // Chuẩn hóa tham số
  ) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const dictionaryItem = this.notificationDictionary[messageKey];

    if (!dictionaryItem) {
      this.logger.error(`❌ Không tìm thấy bản dịch cho key: ${messageKey}`);
      return;
    }

    // 1. Kiểm tra xem hôm nay đã spam user loại thông báo này chưa
    const existingNotification = await this.prisma.notification.findFirst({
      where: {
        userId,
        type: dictionaryItem.inApp.type, // Map chuẩn theo In-App type
        createdAt: { gte: startOfToday },
      },
    });

    if (existingNotification) {
      this.logger.log(
        `⚠️ User ${userId} đã nhận báo động ${messageKey} hôm nay. Bỏ qua để tránh spam.`,
      );
      return;
    }

    // 2. Lấy thông tin user và kiểm tra quyền gửi
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    // TÔN TRỌNG CÀI ĐẶT CỦA USER: Nếu user đã vào App và tắt cảnh báo ngân sách -> Bỏ qua
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
    // Fallback mặc định nếu lúc gọi hàm bạn quên không truyền data
    const args: string[] = [];
    if (data?.budgetName) args.push(data.budgetName);
    else args.push('Ví của bạn'); // Fallback tên ví

    if (data?.percentage) args.push(data.percentage);
    else args.push('80'); // Fallback số %

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
          arguments: args, // Prisma giờ đã nhận mảng string
        },
      });
    } catch (dbError) {
      this.logger.error('❌ Lỗi khi lưu Notification vào DB:', dbError);
      // Vẫn tiếp tục chạy để bắn Push cho dù DB lỗi
    }

    // ==========================================
    // 📲 BẮN PUSH NOTIFICATION (FIREBASE)
    // ==========================================
    if (!user.fcmToken) {
      this.logger.log(
        `⚠️ User ${userId} chưa có thiết bị (FCM Token). Đã lưu In-App thành công.`,
      );
      return;
    }

    const userLang = user.language === 'en' ? 'en' : 'vi';
    const translation = dictionaryItem[userLang];

    const payload: admin.messaging.Message = {
      token: user.fcmToken,
      notification: {
        // FCM bắt buộc dùng text thật, không dùng Key
        title: translation.title,
        body: translation.body,
      },
      data: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        ...data, // Nhét thêm data ẩn để Flutter handle khi user bấm vào
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
