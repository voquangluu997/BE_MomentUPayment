import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản thành viên mới' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({
    summary: 'Đăng nhập bằng tài khoản và mật khẩu thông thường',
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google-login')
  @ApiOperation({
    summary: 'Đăng nhập hoặc Đăng ký nhanh thông qua Google Access Token',
  })
  async googleLogin(@Body('accessToken') accessToken: string) {
    if (!accessToken) {
      throw new BadRequestException('Google access token is required.');
    }
    return this.authService.googleLogin(accessToken);
  }

  @Get('activate')
  @ApiOperation({
    summary: 'Webhook nhận link kích hoạt tài khoản từ hòm thư của User',
  })
  async activate(@Query('token') token: string) {
    if (!token) {
      throw new BadRequestException('Activation token is missing.');
    }
    return this.authService.activate(token);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('me')
  @ApiOperation({
    summary: 'Lấy thông tin chi tiết của người dùng đang đăng nhập',
  })
  async getProfile(@Req() req: any) {
    // Controller vẫn xử lý lấy thông tin từ request, không cần Service
    const user = req.user;
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('resend-verification')
  @ApiOperation({
    summary: 'Yêu cầu gửi lại email kích hoạt tài khoản chính chủ',
  })
  async resendVerification(@Req() req: any) {
    return this.authService.resendVerification(req.user.id);
  }
}
