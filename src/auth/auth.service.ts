import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../users/user.service'; // Lấy từ Controller cũ
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private jwtService: JwtService,
    @InjectQueue('mail-queue') private mailQueue: Queue,
  ) {}

  // =========================================================================
  // 1. ĐĂNG KÝ (REGISTER)
  // =========================================================================
  async register(dto: RegisterDto) {
    const existingUser = await this.userService.findByEmail(dto.email);
    if (existingUser) {
      throw new BadRequestException('Email đã tồn tại rùi nè! 💕');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Lưu user vào DB
    const newUser = await this.userService.createUser({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      verificationToken: verificationToken,
      isEmailVerified: false,
    });

    // Gửi mail vô hàng đợi
    await this.mailQueue.add('send-activation-email', {
      email: newUser.email,
      token: verificationToken,
    });

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

  // =========================================================================
  // 2. ĐĂNG NHẬP (LOGIN)
  // =========================================================================
  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user || !user.password) {
      throw new UnauthorizedException(
        'Sai email hoặc mật khẩu mất tiêu rồi! 😢',
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Sai email hoặc mật khẩu mất tiêu rồi! 😢',
      );
    }

    // ==========================================
    // 🔔 LẦN ĐẦU ĐĂNG NHẬP: Bắn combo 3 thông báo Onboarding
    // ==========================================
    if (user['isFirstLogin'] === true) {
      try {
        // 1. Nhắc xác thực Email (Nếu chưa xác thực)
        if (!user.isEmailVerified) {
          await this.prisma.notification.create({
            data: {
              userId: user.id,
              type: 'first_login_reminder',
              titleKey: 'notiFirstLoginReminderTitle',
              bodyKey: 'notiFirstLoginReminderBody',
              arguments: [user.name || 'bạn hiền'],
            },
          });
        }

        // 2. Nhắc tạo Moment Payment đầu tiên
        await this.prisma.notification.create({
          data: {
            userId: user.id,
            type: 'onboarding_first_transaction', // Type này dùng để làm Deep Link trên Flutter
            titleKey: 'notiFirstTxnTitle',
            bodyKey: 'notiFirstTxnBody',
            arguments: [],
          },
        });

        // 3. Nhắc thiết lập ngân sách chi tiêu
        await this.prisma.notification.create({
          data: {
            userId: user.id,
            type: 'onboarding_set_budget', // Type này dùng để làm Deep Link trên Flutter
            titleKey: 'notiSetBudgetTitle',
            bodyKey: 'notiSetBudgetBody',
            arguments: [],
          },
        });

        // Đánh dấu đã qua lần đăng nhập đầu tiên
        await this.userService.updateUser(user.id, {
          isFirstLogin: false,
        } as any);
      } catch (error) {
        console.error('Lỗi khi tạo combo thông báo lần đầu đăng nhập:', error);
      }
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

  // =========================================================================
  // 3. ĐĂNG NHẬP BẰNG GOOGLE (GOOGLE LOGIN)
  // =========================================================================
  async googleLogin(accessToken: string) {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`,
    );
    const googleUser = await response.json();

    if (googleUser.error) {
      throw new BadRequestException('Google token is invalid or expired.');
    }

    let user = await this.userService.findByEmail(googleUser.email);

    if (!user) {
      user = await this.userService.createUser({
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
        googleId: googleUser.sub,
        isEmailVerified: true,
      });
    } else {
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

  // =========================================================================
  // 4. KÍCH HOẠT EMAIL TỪ LINK (ACTIVATE)
  // =========================================================================
  async activate(token: string) {
    const user = await this.userService.findByVerificationToken(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired token.');
    }

    // Cập nhật trạng thái user
    await this.userService.updateUser(user.id, {
      isEmailVerified: true,
      verificationToken: null,
    });

    // 🔔 THÔNG BÁO 3: Xác thực email thành công
    try {
      const userSettings = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { notiSecuritySystem: true },
      });

      if (userSettings?.notiSecuritySystem !== false) {
        await this.prisma.notification.create({
          data: {
            userId: user.id,
            type: 'email_verified',
            titleKey: 'notiEmailVerifiedTitle',
            bodyKey: 'notiEmailVerifiedBody',
            arguments: [],
          },
        });
      }
    } catch (error) {
      console.error('Lỗi khi tạo thông báo xác thực:', error);
    }

    return `
      <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px;">
        <h1 style="color: #3949AB;">🎉 Account Activated Successfully!</h1>
        <p style="color: #4B5563; font-size: 16px;">Your email has been verified. You can now return to your Moment U Payment app.</p>
      </div>
    `;
  }

  // =========================================================================
  // 5. GỬI LẠI EMAIL KÍCH HOẠT (RESEND VERIFICATION)
  // =========================================================================
  async resendVerification(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('User profile not found.');
    }

    if (user.isEmailVerified) {
      return { success: true, message: 'Email already verified.' };
    }

    const newToken = crypto.randomBytes(32).toString('hex');
    await this.userService.updateUser(user.id, { verificationToken: newToken });

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
