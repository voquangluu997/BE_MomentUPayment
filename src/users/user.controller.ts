// users/user.controller.ts
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
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UpdateFcmTokenDto } from './dto/fcm-token.dto';
import { FirebaseAdminService } from 'src/modules/firebase/firebase-admin.service';

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
    // req.user.id được lấy từ JwtStrategy sau khi validate token thành công
    return this.userService.updateBudget(req.user.id, dto);
  }

  @Patch('fcm-token')
  // @UseGuards(JwtAuthGuard) // Bật cái này nếu bạn đã làm hệ thống Auth bằng JWT nhé
  async updateFcmToken(@Req() req, @Body() dto: UpdateFcmTokenDto) {
    const userId = req.user.id || 'user_id_test_123'; // Lấy ID user từ token đăng nhập
    return this.userService.saveFcmToken(userId, dto.fcmToken, dto.language);
  }

  @Get('budget/summary')
  async getSummary(@Req() req) {
    return this.userService.getBudgetSummary(req.user.id);
  }

  // 🚀 API kiểm tra nhanh tính năng Push Notification
  // @Post('test-push')
  // async testPushNotification(@Body() body: { token: string }) {
  //   const title = 'Ủa alo? Ví sắp cạn kìa! 👀';
  //   const bodyText =
  //     'Ví thông báo: Năng lượng ví còn 12%. Đề nghị bật chế độ tiết kiệm năng lượng khẩn cấp để sinh tồn! 🔋';

  //   await this.firebaseService.sendPushNotification(
  //     body.token,
  //     title,
  //     bodyText,
  //     {
  //       click_action: 'FLUTTER_NOTIFICATION_CLICK',
  //       screen: 'budget_analytics',
  //     },
  //   );

  //   return { success: true, message: 'Đã phát lệnh bắn thông báo thành công!' };
  // }
}
