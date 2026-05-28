import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FirebaseAdminService {
  constructor(private readonly prisma: PrismaService) {}

  // 🌐 Kho văn mẫu đa ngôn ngữ đậm chất sinh tồn của Moment u Payment
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
    },
  };

  /**
   * 🚀 Gửi thông báo tự động tra cứu ngôn ngữ dựa trên userId
   */
  async sendLocalizedNotification(
    userId: string,
    messageKey: string,
    data?: any,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Nếu user không tồn tại hoặc không cấp quyền nhận thông báo (fcmToken null) thì bỏ qua
    if (!user || !user.fcmToken) return;

    const userLang = user.language || 'vi';
    const translation = this.notificationDictionary[messageKey]?.[userLang];

    if (!translation) {
      console.error(`❌ Không tìm thấy bản dịch cho key: ${messageKey}`);
      return;
    }

    const payload: admin.messaging.Message = {
      token: user.fcmToken,
      notification: {
        title: translation.title,
        body: translation.body,
      },
      data: data || {},
      android: {
        priority: 'high',
      },
    };

    try {
      await admin.messaging().send(payload);
      console.log(
        `✅ Đã bắn thông báo [${messageKey}] bằng tiếng [${userLang}] tới User: ${userId}`,
      );
    } catch (error) {
      console.error('❌ Lỗi kết nối gửi Firebase Admin SDK:', error);
    }
  }
}
