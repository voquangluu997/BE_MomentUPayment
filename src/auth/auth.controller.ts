import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  BadRequestException,
  UnauthorizedException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { UserService } from '../users/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @InjectQueue('mail-queue') private mailQueue: Queue,
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  // =========================================================================
  // 🔓 NHÓM 1: PUBLIC ENDPOINTS (Không cần gắn Token JWT ở Header)
  // =========================================================================

  /**
   * POST /auth/register - Đăng ký tài khoản thông thường
   */
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản thành viên mới' })
  async register(@Body() dto: RegisterDto) {
    // Kiểm tra xem email đã tồn tại chưa
    const existingUser = await this.userService.findByEmail(dto.email);
    if (existingUser) {
      throw new BadRequestException('Email is already registered.');
    }

    // Sử dụng bcrypt để băm mật khẩu an toàn
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);

    // Tạo mã token ngẫu nhiên để phục vụ kích hoạt tài khoản qua mail
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Lưu user vào DB (Mặc định isEmailVerified = false)
    const newUser = await this.userService.createUser({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      verificationToken: verificationToken,
      isEmailVerified: false,
    });

    // Đẩy tác vụ gửi mail vào hàng đợi Redis để xử lý background worker ngầm
    await this.mailQueue.add('send-activation-email', {
      email: newUser.email,
      token: verificationToken,
    });

    // Phát hành luôn JWT token cho phép User đăng nhập thẳng vào App không cần đợi verify
    const backendToken = this.jwtService.sign({ userId: newUser.id });

    return {
      success: true,
      message: 'Registration successful! Verification email sent.',
      backend_jwt_token: backendToken,
      user: {
        email: newUser.email,
        isEmailVerified: newUser.isEmailVerified,
      },
    };
  }

  /**
   * POST /auth/login - Đăng nhập truyền thống
   */
  @Post('login')
  @ApiOperation({
    summary: 'Đăng nhập bằng tài khoản và mật khẩu thông thường',
  })
  async login(@Body() dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    // So sánh mật khẩu người dùng gửi lên với mật khẩu đã mã hóa trong DB
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const backendToken = this.jwtService.sign({ userId: user.id });
    return {
      success: true,
      backend_jwt_token: backendToken,
      user: {
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  /**
   * POST /auth/google-login - Xác thực Token từ Google (Flutter gửi lên)
   */
  @Post('google-login')
  @ApiOperation({
    summary: 'Đăng nhập hoặc Đăng ký nhanh thông qua Google Access Token',
  })
  async googleLogin(@Body('accessToken') accessToken: string) {
    if (!accessToken) {
      throw new BadRequestException('Google access token is required.');
    }

    const response = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`,
    );
    const googleUser = await response.json();

    if (googleUser.error) {
      throw new BadRequestException('Google token is invalid or expired.');
    }

    let user = await this.userService.findByEmail(googleUser.email);

    if (!user) {
      // Trường hợp chưa có nick -> Tạo mới hoàn toàn (Mặc định auto-verify email luôn)
      user = await this.userService.createUser({
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
        googleId: googleUser.sub,
        isEmailVerified: true,
      });
    } else {
      // Trường hợp đã có nick bằng email trước đó -> Liên kết thêm Google ID & chuyển verify thành true
      user = await this.userService.updateUser(user.id, {
        googleId: googleUser.sub,
        isEmailVerified: true,
      });
    }

    const backendToken = this.jwtService.sign({ userId: user.id });

    return {
      success: true,
      message: 'Google login authenticated successfully.',
      backend_jwt_token: backendToken,
      user: {
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  /**
   * GET /auth/activate - Nhận link kích hoạt từ Email người dùng click vào
   */
  @Get('activate')
  @ApiOperation({
    summary: 'Webhook nhận link kích hoạt tài khoản từ hòm thư của User',
  })
  async activate(@Query('token') token: string) {
    if (!token) {
      throw new BadRequestException('Activation token is missing.');
    }

    const user = await this.userService.findByVerificationToken(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired token.');
    }

    // Cập nhật trạng thái và xóa token để tránh tái sử dụng link cũ
    await this.userService.updateUser(user.id, {
      isEmailVerified: true,
      verificationToken: null,
    });

    return `
      <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px;">
        <h1 style="color: #3949AB;">🎉 Account Activated Successfully!</h1>
        <p style="color: #4B5563; font-size: 16px;">Your email has been verified. You can now return to your Moment U Payment app.</p>
      </div>
    `;
  }

  // =========================================================================
  // 🔒 NHÓM 2: PROTECTED ENDPOINTS (Bảo mật nghiêm ngặt - Yêu cầu Bearer JWT Token)
  // =========================================================================

  /**
   * GET /auth/me - Lấy thông tin chi tiết của người dùng hiện tại
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('me')
  @ApiOperation({
    summary: 'Lấy thông tin chi tiết của người dùng đang đăng nhập',
  })
  async getProfile(@Req() req: any) {
    // req.user được điền tự động sau khi vượt qua JwtAuthGuard nhờ vào JwtStrategy
    const user = req.user;

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isEmailVerified: user.isEmailVerified, // Đồng bộ trực tiếp cho trạng thái hiển thị của Flutter
      },
    };
  }

  /**
   * POST /auth/resend-verification - Gửi lại email xác thực (Lazy Verification)
   * 🛡️ ĐÃ SỬA: Thêm JwtAuthGuard bảo vệ để lấy email chính chủ từ Token, triệt tiêu Spam gửi mail ảo.
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('resend-verification')
  @ApiOperation({
    summary: 'Yêu cầu gửi lại email kích hoạt tài khoản chính chủ',
  })
  async resendVerification(@Req() req: any) {
    // Lấy ID người dùng an toàn trực tiếp từ phiên đăng nhập hiện tại
    const userId = req.user.id;

    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('User profile not found.');
    }

    if (user.isEmailVerified) {
      return {
        success: true,
        message: 'Email already verified.',
      };
    }

    // Tạo token kích hoạt mới cứng
    const newToken = crypto.randomBytes(32).toString('hex');
    await this.userService.updateUser(user.id, { verificationToken: newToken });

    // Đẩy tiếp vào hàng đợi gửi mail của BullQueue
    await this.mailQueue.add('send-activation-email', {
      email: user.email,
      token: newToken,
    });

    return {
      success: true,
      message: 'New verification email dispatched successfully.',
    };
  }
}
