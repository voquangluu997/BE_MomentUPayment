// users/user.controller.ts
import { Controller, Patch, Body, UseGuards, Req, Get } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@Controller('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard) // Bảo vệ tất cả endpoint trong controller này bằng JWT
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch('budget')
  @ApiOperation({ summary: 'Đặt lại ngưỡng cảnh báo giới hạn chi tiêu' })
  async updateBudget(@Req() req: any, @Body() dto: UpdateBudgetDto) {
    // req.user.id được lấy từ JwtStrategy sau khi validate token thành công
    return this.userService.updateBudget(req.user.id, dto);
  }
  @Get('budget/summary')
  async getSummary(@Req() req) {
    return this.userService.getBudgetSummary(req.user.id);
  }
}
