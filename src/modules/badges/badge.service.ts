import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class BadgesService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  // 1. Lấy danh sách huy hiệu khi user mở app
  async getUserBadges(userId: string): Promise<string[]> {
    const userBadges = await this.prisma.userBadge.findMany({
      where: { userId },
      select: { badgeId: true },
    });

    // Trả về một mảng string (ví dụ: ['firstBlood', 'richKid']) để Flutter dễ xử lý
    return userBadges.map((badge) => badge.badgeId);
  }

  async unlockBadges(userId: string, newBadges: string[]) {
    if (!newBadges || newBadges.length === 0) {
      return { addedCount: 0 };
    }

    const badgeDataToInsert = newBadges.map((badgeId) => ({
      userId,
      badgeId,
    }));

    const result = await this.prisma.userBadge.createMany({
      data: badgeDataToInsert,
      skipDuplicates: true,
    });

    // 🚀 BỔ SUNG: Bắn thông báo In-app cho từng huy hiệu được thêm thành công
    // Chỉ bắn thông báo nếu thực sự có huy hiệu mới được thêm (tránh spam khi duplicate)
    if (result.count > 0) {
      for (const badgeId of newBadges) {
        await this.notificationService.createNotification({
          userId: userId,
          type: 'badge_unlocked',
          titleKey: 'NOTI_BADGE_UNLOCKED_TITLE', // Key đa ngôn ngữ cho Flutter
          bodyKey: 'NOTI_BADGE_UNLOCKED_BODY',
          arguments: [badgeId], // Truyền ID huy hiệu để Flutter hiển thị icon/tên tương ứng
        });
      }
    }

    return {
      message: 'Đã đồng bộ thành tựu',
      addedCount: result.count,
    };
  }

  async lockBadges(userId: string, badgesToLock: string[]) {
    if (!badgesToLock || badgesToLock.length === 0) {
      return { lockedCount: 0 };
    }

    // Xóa các huy hiệu nằm trong danh sách truyền vào của user này
    const result = await this.prisma.userBadge.deleteMany({
      where: {
        userId: userId,
        badgeId: { in: badgesToLock },
      },
    });

    return {
      message: 'Đã khóa huy hiệu thành công!',
      lockedCount: result.count,
    };
  }

  // 🚀 BỔ SUNG: Hàm dùng cho hệ thống tự động Reset hàng tháng (CronJob)
  async resetMonthlyBadgesSystemWide(monthlyBadgeIds: string[]) {
    // Xóa các huy hiệu này của TẤT CẢ user
    const result = await this.prisma.userBadge.deleteMany({
      where: {
        badgeId: { in: monthlyBadgeIds },
      },
    });

    console.log(
      `[TỰ ĐỘNG] Đã reset ${result.count} huy hiệu tháng cho toàn bộ user.`,
    );
  }
}
