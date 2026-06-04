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

  // 3. Đánh dấu đã đọc 1 thông báo
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
  // 🚀 HÀM MỚI: ĐÁNH DẤU TẤT CẢ ĐÃ ĐỌC
  // =========================================================================
  async markAllAsRead(userId: string) {
    // Cập nhật tất cả các thông báo chưa đọc của user này thành đã đọc
    const result = await this.prisma.notification.updateMany({
      where: { userId: userId, isRead: false },
      data: { isRead: true },
    });

    return {
      message: 'Đã đánh dấu tất cả là đã đọc',
      updatedCount: result.count,
    };
  }

  // =========================================================================
  // HÀM: TẠO THÔNG BÁO (KÈM CHECK SETTINGS)
  // =========================================================================
  async createNotification(data: {
    userId: string;
    type: string;
    titleKey: string;
    bodyKey: string;
    arguments?: string[];
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
      select: {
        notiBudgetAlerts: true,
        notiSecuritySystem: true,
        notiSharedWallet: true,
      },
    });

    if (!user) return null;

    if (data.type.startsWith('budget') && !user.notiBudgetAlerts) {
      return null;
    }
    if (data.type === 'email_verified' && !user.notiSecuritySystem) {
      return null;
    }
    if (data.type === 'aggregated_tx' && !user.notiSharedWallet) {
      return null;
    }

    const newNotification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        titleKey: data.titleKey,
        bodyKey: data.bodyKey,
        arguments: data.arguments || [],
      },
    });

    return newNotification;
  }
}
