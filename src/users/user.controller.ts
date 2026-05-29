import {
  Controller,
  Patch,
  Body,
  UseGuards,
  Req,
  Get,
  Post,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdateFcmTokenDto } from './dto/fcm-token.dto';
import { FirebaseAdminService } from 'src/modules/firebase/firebase-admin.service';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard) // Bảo vệ tất cả endpoint trong controller này bằng JWT
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly firebaseService: FirebaseAdminService,
  ) {}

  @Patch('budget')
  @ApiOperation({ summary: 'Đặt lại ngưỡng cảnh báo giới hạn chi tiêu' })
  async updateBudget(@Req() req: any, @Body() dto: UpdateBudgetDto) {
    return this.userService.updateBudget(req.user.id, dto);
  }

  @Patch('fcm-token')
  @ApiOperation({ summary: 'Cập nhật FCM Token cho Push Notification' })
  async updateFcmToken(@Req() req: any, @Body() dto: UpdateFcmTokenDto) {
    return this.userService.saveFcmToken(
      req.user.id,
      dto.fcmToken,
      dto.language,
    );
  }

  @Get('budget/summary')
  @ApiOperation({ summary: 'Lấy tóm tắt ngân sách chi tiêu hiện tại' })
  async getSummary(@Req() req: any) {
    return this.userService.getBudgetSummary(req.user.id);
  }

  @Get('notification-settings')
  @ApiOperation({
    summary: 'Lấy cấu hình cài đặt nhận thông báo của người dùng',
  })
  async getNotificationSettings(@Req() req: any) {
    return this.userService.getNotificationSettings(req.user.id);
  }

  @Patch('notification-settings')
  @ApiOperation({
    summary: 'Cập nhật cấu hình cài đặt nhận thông báo (Bật/Tắt)',
  })
  async updateNotificationSettings(@Req() req: any, @Body() body: any) {
    return this.userService.updateNotificationSettings(req.user.id, body);
  }

  // 🚀 API kiểm tra nhanh tính năng Push Notification (Giữ lại nếu bạn cần test)
  // @Post('test-push')
  // @ApiOperation({ summary: 'Test bắn thông báo Push qua Firebase' })
  // async testPushNotification(@Body() body: { token: string }) {
  //   const title = 'Ủa alo? Ví sắp cạn kìa! 👀';
  //   const bodyText = 'Năng lượng ví còn 12%. Đề nghị tiết kiệm khẩn cấp! 🔋';
  //   await this.firebaseService.sendPushNotification(body.token, title, bodyText, {
  //     click_action: 'FLUTTER_NOTIFICATION_CLICK',
  //     screen: 'budget_analytics',
  //   });
  //   return { success: true, message: 'Đã phát lệnh bắn thông báo thành công!' };
  // }
}
