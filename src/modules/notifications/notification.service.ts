import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Lấy danh sách thông báo
  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  // 2. Lấy số lượng chưa đọc
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  // 3. Đánh dấu đã đọc
  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo!');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  // =========================================================================
  // 🚀 HÀM MỚI: TẠO THÔNG BÁO (KÈM CHECK SETTINGS)
  // Gọi hàm này ở bất cứ đâu trong hệ thống (TransactionService, AuthService...)
  // =========================================================================
  async createNotification(data: {
    userId: string;
    type: string;
    titleKey: string;
    bodyKey: string;
    arguments?: string[];
  }) {
    // 1. Lấy settings của user để kiểm tra xem họ có cho phép gửi không
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
      select: {
        notiBudgetAlerts: true,
        notiSecuritySystem: true,
        notiSharedWallet: true,
      },
    });

    if (!user) return null;

    // 2. Chặn Spam dựa theo type và settings
    if (data.type.startsWith('budget') && !user.notiBudgetAlerts) {
      return null; // Bỏ qua, không lưu vào DB vì user đã tắt cảnh báo ngân sách
    }
    if (data.type === 'email_verified' && !user.notiSecuritySystem) {
      return null; // Bỏ qua bảo mật
    }
    if (data.type === 'aggregated_tx' && !user.notiSharedWallet) {
      return null; // Bỏ qua thông báo ví nhóm
    }

    // 3. Nếu qua được bộ lọc, tiến hành lưu vào DB và (tùy chọn) gọi Firebase Push Noti ở đây
    const newNotification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        titleKey: data.titleKey,
        bodyKey: data.bodyKey,
        arguments: data.arguments || [],
      },
    });

    // Tương lai: Chèn code bắn FCM Push Notification ở đây
    // await this.fcmService.sendPush(user.fcmToken, data);

    return newNotification;
  }
}
