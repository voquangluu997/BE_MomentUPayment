import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    @InjectQueue('mail-queue') private mailQueue: Queue,
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  /**
   * POST /auth/register - Đăng ký tài khoản thông thường
   */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    // Kiểm tra xem email đã tồn tại chưa
    const existingUser = await this.userService.findByEmail(dto.email);
    if (existingUser) {
      throw new BadRequestException('Email is already registered.');
    }

    // 1. SỬ DỤNG BCRYPT ĐỂ SỬA LỖI HASHED_PASSWORD
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);

    // Tạo mã token ngẫu nhiên để phục vụ xác thực sau
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // 2. Lưu user vào DB (Mặc định chưa verify nhưng vẫn cho đăng ký)
    const newUser = await this.userService.createUser({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      verificationToken: verificationToken,
      isEmailVerified: false,
    });

    // 3. Đẩy tác vụ gửi mail vào hàng đợi Redis để xử lý ngầm
    await this.mailQueue.add('send-activation-email', {
      email: newUser.email,
      token: verificationToken,
    });

    // 4. Phát hành JWT token cho phép User đăng nhập thẳng vào App ngay lập tức
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
   * GET /auth/activate - Nhận link kích hoạt từ Email người dùng click vào
   */
  @Get('activate')
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
        <h1 style="color: #008080;">🎉 Account Activated Successfully!</h1>
        <p>Your email has been verified. You can now return to your Moment U Payment app.</p>
      </div>
    `;
  }

  /**
   * POST /auth/google-login - Xác thực Token từ Google (Flutter gửi lên)
   */
  @Post('google-login')
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
      // Trường hợp chưa có nick -> Tạo mới hoàn toàn (mặc định tin tưởng)
      user = await this.userService.createUser({
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
        googleId: googleUser.sub,
        isEmailVerified: true,
      });
    } else {
      // Trường hợp đã có nick bằng email trước đó -> Liên kết thêm Google ID
      user = await this.userService.updateUser(user.id, {
        googleId: googleUser.sub,
        isEmailVerified: true, // Auto kích hoạt email nếu tài khoản gốc chưa click link mail
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
   * POST /auth/resend-verification - Gửi lại email xác thực (Lazy Verification)
   */
  @Post('resend-verification')
  async resendVerification(@Body('email') email: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) throw new BadRequestException('User not found.');
    if (user.isEmailVerified) return { message: 'Email already verified.' };

    const newToken = crypto.randomBytes(32).toString('hex');
    await this.userService.updateUser(user.id, { verificationToken: newToken });

    await this.mailQueue.add('send-activation-email', {
      email: user.email,
      token: newToken,
    });

    return { success: true, message: 'New verification email dispatched.' };
  }
}
