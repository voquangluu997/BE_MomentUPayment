import appleSignin from 'apple-signin-auth';
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../users/user.service';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter'; // 🚀 Import EventEmitter
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AppleLoginDto } from './dto/apple-login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private jwtService: JwtService,
    private eventEmitter: EventEmitter2, // 🚀 Thay thế Queue bằng EventEmitter
  ) {}

  // =========================================================================
  // 1. ĐĂNG KÝ (REGISTER)
  // =========================================================================
  async register(dto: RegisterDto) {
    const existingUser = await this.userService.findByEmail(dto.email);
    if (existingUser) {
      throw new BadRequestException('error_email_already_exists');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // 1. Tạo user trong DB
    const newUser = await this.userService.createUser({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      verificationToken: verificationToken,
      isEmailVerified: false,
    });

    // 2. Gửi mail "Fire and Forget" qua Event Emitter
    try {
      this.eventEmitter.emit('mail.send-activation-email', {
        email: newUser.email,
        token: verificationToken,
        type: 'welcome',
      });
    } catch (mailError) {
      console.error('❌ Cảnh báo: Không thể phát sự kiện gửi mail:', mailError);
    }

    // 3. Trả về thành công
    const backendToken = this.jwtService.sign({ userId: newUser.id });
    return {
      success: true,
      message: 'Registration successful! (Email verification pending)',
      backend_jwt_token: backendToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        isEmailVerified: false,
      },
    };
  }

  // =========================================================================
  // 2. ĐĂNG NHẬP (LOGIN)
  // =========================================================================
  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('error_invalid_credentials');
    }

    // 💡 Xử lý thân thiện cho user đăng nhập Google nhưng bấm nhầm sang form Login thường
    if (!user.password) {
      throw new UnauthorizedException('error_google_linked');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('error_invalid_credentials');
    }

    // Xử lý thông báo lần đầu đăng nhập
    if (user['isFirstLogin'] === true) {
      try {
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

        await this.prisma.notification.create({
          data: {
            userId: user.id,
            type: 'onboarding_first_transaction',
            titleKey: 'notiFirstTxnTitle',
            bodyKey: 'notiFirstTxnBody',
            arguments: [],
          },
        });

        await this.prisma.notification.create({
          data: {
            userId: user.id,
            type: 'onboarding_set_budget',
            titleKey: 'notiSetBudgetTitle',
            bodyKey: 'notiSetBudgetBody',
            arguments: [],
          },
        });

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
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
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
      throw new BadRequestException('error_google_token_invalid');
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
      // 💡 Không ghi đè password hiện tại nếu user đã reset mật khẩu trước đó
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
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  // =========================================================================
  // 3.5. ĐĂNG NHẬP BẰNG APPLE (APPLE LOGIN)
  // =========================================================================
  async appleLogin(dto: AppleLoginDto) {
    let decodedAppleToken: any;

    try {
      // Xác thực token với máy chủ Apple
      decodedAppleToken = await appleSignin.verifyIdToken(dto.identityToken, {
        audience: process.env.APP_BUNDLE_ID,
        ignoreExpiration: true, // Xoá dòng này đi khi đưa lên Production
      });
    } catch (error) {
      throw new BadRequestException('error_apple_token_invalid');
    }

    const appleId = decodedAppleToken.sub;
    const email = decodedAppleToken.email;

    // Apple có tính năng "Hide My Email" (ẩn email thật),
    // lúc này email sẽ có đuôi dạng @privaterelay.appleid.com
    if (!email) {
      throw new BadRequestException('error_apple_email_missing');
    }

    let user = await this.userService.findByEmail(email);

    if (!user) {
      // Xử lý nối tên do Apple gửi lên (chỉ có ở lần đăng nhập đầu)
      let fullName = 'Apple User'; // Fallback name
      if (dto.name && (dto.name.firstName || dto.name.lastName)) {
        fullName =
          `${dto.name.firstName || ''} ${dto.name.lastName || ''}`.trim();
      }

      user = await this.userService.createUser({
        email: email,
        name: fullName,
        appleId: appleId, // Lưu Apple ID
        isEmailVerified: true, // Email của Apple đã được xác thực
      });
    } else {
      // Cập nhật appleId cho user hiện tại nếu họ dùng chung email
      user = await this.userService.updateUser(user.id, {
        appleId: appleId,
        isEmailVerified: true,
      } as any);
    }

    const backendToken = this.jwtService.sign({ userId: user.id });

    return {
      success: true,
      message: 'Apple login authenticated successfully.',
      backend_jwt_token: backendToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
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
      throw new BadRequestException('error_invalid_activation_token');
    }

    await this.userService.updateUser(user.id, {
      isEmailVerified: true,
      verificationToken: null,
    });

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
        <p style="color: #4B5563; font-size: 16px;">Your email has been verified. You can now return to your Moments U Payment app.</p>
      </div>
    `;
  }

  // =========================================================================
  // 5. GỬI LẠI EMAIL KÍCH HOẠT (RESEND VERIFICATION)
  // =========================================================================
  async resendVerification(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('error_user_not_found');
    }

    if (user.isEmailVerified) {
      return { success: true, message: 'Email already verified.' };
    }

    const newToken = crypto.randomBytes(32).toString('hex');
    await this.userService.updateUser(user.id, { verificationToken: newToken });

    // 🚀 Bắn event thay vì add queue
    this.eventEmitter.emit('mail.send-activation-email', {
      email: user.email,
      token: newToken,
    });

    return {
      success: true,
      message: 'New verification email dispatched successfully.',
    };
  }

  // =========================================================================
  // 6. LẤY THÔNG TIN CHI TIẾT USER (GET PROFILE)
  // =========================================================================
  async getProfile(userPayload: any) {
    const dbUser = await this.userService.findById(
      userPayload.id || userPayload.userId,
    );
    if (!dbUser) {
      throw new BadRequestException('error_user_not_found');
    }

    return {
      success: true,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        avatar: dbUser.avatar,
        isEmailVerified: dbUser.isEmailVerified,
      },
    };
  }

  // =========================================================================
  // 7. YÊU CẦU QUÊN MẬT KHẨU (FORGOT PASSWORD)
  // =========================================================================
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestException('error_email_not_found');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);

    await this.userService.updateUser(user.id, {
      resetPasswordOtp: otp,
      resetPasswordExpires: otpExpires,
    } as any);

    // 🚀 Bắn event thay vì add queue
    this.eventEmitter.emit('mail.send-reset-password-email', {
      email: user.email,
      otp: otp,
    });

    return {
      success: true,
      message: 'OTP sent successfully.',
    };
  }

  // =========================================================================
  // 8. ĐẶT LẠI MẬT KHẨU BẰNG OTP (RESET PASSWORD WITH OTP)
  // =========================================================================
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.userService.findByEmail(dto.email);

    if (!user) {
      throw new BadRequestException('error_invalid_account');
    }

    const isOtpValid = user['resetPasswordOtp'] === dto.otp;
    const isOtpExpired = new Date(user['resetPasswordExpires']) < new Date();

    if (!isOtpValid || isOtpExpired) {
      throw new BadRequestException('error_invalid_otp');
    }

    const finalNewPassword = dto.newPassword || (dto as any).password;
    if (!finalNewPassword) {
      throw new BadRequestException('error_missing_password');
    }

    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(finalNewPassword, saltRounds);

    await this.userService.updateUser(user.id, {
      password: hashedNewPassword,
      resetPasswordOtp: null,
      resetPasswordExpires: null,
    } as any);

    return {
      success: true,
      message: 'Password reset successful.',
    };
  }

  // =========================================================================
  // 9. ĐỔI MẬT KHẨU KHI ĐANG ĐĂNG NHẬP (UPDATE PASSWORD)
  // =========================================================================
  async updatePassword(userId: string, dto: UpdatePasswordDto) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('error_invalid_account');
    }

    if (user.password) {
      const isMatch = await bcrypt.compare(dto.oldPassword, user.password);
      if (!isMatch) {
        throw new BadRequestException('error_incorrect_old_password');
      }
    }

    const finalNewPassword = dto.newPassword || (dto as any).password;
    if (!finalNewPassword) {
      throw new BadRequestException('error_missing_password');
    }

    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(finalNewPassword, saltRounds);

    await this.userService.updateUser(userId, {
      password: hashedNewPassword,
    } as any);

    return {
      success: true,
      message: 'Password updated successfully.',
    };
  }

  // =========================================================================
  // 10. CẬP NHẬT HỒ SƠ (UPDATE PROFILE)
  // =========================================================================
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updateData: any = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }

    if (dto.avatar !== undefined) {
      updateData.avatar = dto.avatar;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('error_no_fields_provided');
    }

    const updatedUser = await this.userService.updateUser(userId, updateData);

    return {
      success: true,
      message: 'Profile updated!',
      user: {
        name: updatedUser.name,
        avatar: updatedUser.avatar,
      },
    };
  }
}
