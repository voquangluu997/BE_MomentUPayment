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
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AppleLoginDto } from './dto/apple-login.dto';

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

  @Post('apple-login')
  @ApiOperation({
    summary: 'Đăng nhập hoặc Đăng ký nhanh thông qua Apple Identity Token',
  })
  async appleLogin(@Body() dto: AppleLoginDto) {
    return this.authService.appleLogin(dto);
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
    return this.authService.getProfile(req.user);
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

  @Post('forgot-password')
  @ApiOperation({ summary: 'Yêu cầu gửi mã OTP khôi phục mật khẩu qua Email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Đặt lại mật khẩu mới bằng mã OTP xác thực' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('update-password')
  @ApiOperation({ summary: 'Đổi mật khẩu mới khi người dùng đang đăng nhập' })
  async updatePassword(@Req() req: any, @Body() dto: UpdatePasswordDto) {
    return this.authService.updatePassword(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('update-profile')
  async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.id, dto);
  }
}
