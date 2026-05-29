import { Controller, Get, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // API: GET /notifications -> Lấy danh sách thông báo
  @Get()
  async getNotifications(@Req() req) {
    // Trường hợp chưa bật Guard, bạn có thể thay req.user.id bằng một ID test cứng
    const userId = req.user?.id || 'id-user-test-cua-ban';
    return this.notificationService.getNotifications(userId);
  }

  // API: GET /notifications/unread-count -> Lấy số lượng chưa đọc
  @Get('unread-count')
  async getUnreadCount(@Req() req) {
    const userId = req.user?.id || 'id-user-test-cua-ban';
    return this.notificationService.getUnreadCount(userId);
  }

  // API: PATCH /notifications/:id/read -> Đánh dấu đã đọc
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req) {
    const userId = req.user?.id || 'id-user-test-cua-ban';
    return this.notificationService.markAsRead(id, userId);
  }
}
