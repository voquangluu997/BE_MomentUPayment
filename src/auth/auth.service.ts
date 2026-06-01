import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../users/user.service';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private jwtService: JwtService,
    @InjectQueue('mail-queue') private mailQueue: Queue,
  ) {}

  // =========================================================================
  // 1. ĐĂNG KÝ (REGISTER) - ĐÃ THÊM CƠ CHẾ ROLLBACK KHI LỖI MAIL QUEUE
  // =========================================================================
  async register(dto: RegisterDto) {
    const existingUser = await this.userService.findByEmail(dto.email);
    if (existingUser) {
      throw new BadRequestException('Email đã tồn tại rùi nè! 💕');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Bước 1: Khởi tạo tài khoản người dùng trong DB trước
    const newUser = await this.userService.createUser({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      verificationToken: verificationToken,
      isEmailVerified: false,
    });

    // Bước 2: Đẩy tác vụ gửi Mail vào hàng đợi Bull Queue
    try {
      await this.mailQueue.add('send-activation-email', {
        email: newUser.email,
        token: verificationToken,
      });
    } catch (mailError) {
      console.error('❌ Lỗi hệ thống hàng đợi gửi mail:', mailError);

      // 🛠️ THỰC HIỆN ROLLBACK: Xóa tài khoản vừa tạo để giải phóng Email
      try {
        await this.prisma.user.delete({
          where: { id: newUser.id },
        });
        console.log(`🔄 Rollback thành công: Đã xóa user ID ${newUser.id}`);
      } catch (dbError) {
        console.error(
          '🚨 Lỗi nghiêm trọng: Không thể xóa user khi thực hiện rollback!',
          dbError,
        );
      }

      // Ném ra lỗi thông báo cho client biết đăng ký thất bại
      throw new BadRequestException(
        'Đăng ký tài khoản không thành công do hệ thống xác thực mail gặp sự cố. Vui lòng thử lại sau! 😢',
      );
    }

    // Bước 3: Nếu mọi thứ suôn sẻ, tiến hành ký Token và trả về kết quả thành công
    const backendToken = this.jwtService.sign({ userId: newUser.id });

    return {
      success: true,
      message: 'Registration successful! Verification email sent.',
      backend_jwt_token: backendToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        avatar: newUser.avatar,
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
      throw new BadRequestException('Invalid or expired token.');
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

  // =========================================================================
  // 6. LẤY THÔNG TIN CHI TIẾT USER (GET PROFILE)
  // =========================================================================
  async getProfile(userPayload: any) {
    const dbUser = await this.userService.findById(
      userPayload.id || userPayload.userId,
    );
    if (!dbUser) {
      throw new BadRequestException('User profile not found.');
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
      throw new BadRequestException(
        'Email này chưa được đăng ký tài khoản rùi! 😢',
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);

    await this.userService.updateUser(user.id, {
      resetPasswordOtp: otp,
      resetPasswordExpires: otpExpires,
    } as any);

    await this.mailQueue.add('send-reset-password-email', {
      email: user.email,
      otp: otp,
    });

    return {
      success: true,
      message: 'Mã xác thực OTP khôi phục mật khẩu đã gửi vào hòm thư! ✉️',
    };
  }

  // =========================================================================
  // 8. ĐẶT LẠI MẬT KHẨU BẰNG OTP (RESET PASSWORD WITH OTP)
  // =========================================================================
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.userService.findByEmail(dto.email);

    if (!user) {
      throw new BadRequestException(
        'Thông tin xác thực tài khoản không hợp lệ! ❌',
      );
    }

    const isOtpValid = user['resetPasswordOtp'] === dto.otp;
    const isOtpExpired = new Date(user['resetPasswordExpires']) < new Date();

    if (!isOtpValid || isOtpExpired) {
      throw new BadRequestException(
        'Mã OTP không chính xác hoặc đã hết hạn mất rồi! ❌',
      );
    }

    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(dto.newPassword, saltRounds);

    await this.userService.updateUser(user.id, {
      password: hashedNewPassword,
      resetPasswordOtp: null,
      resetPasswordExpires: null,
    } as any);

    return {
      success: true,
      message: 'Đặt lại mật khẩu mới thành công rùi nè! 🎉',
    };
  }

  // =========================================================================
  // 9. ĐỔI MẬT KHẨU KHI ĐANG ĐĂNG NHẬP (UPDATE PASSWORD)
  // =========================================================================
  async updatePassword(userId: string, dto: UpdatePasswordDto) {
    const user = await this.userService.findById(userId);
    if (!user || !user.password) {
      throw new BadRequestException(
        'Không tìm thấy thông tin tài khoản hợp lệ! 😢',
      );
    }

    const isMatch = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu hiện tại chưa đúng rồi nè! ❌');
    }

    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(dto.newPassword, saltRounds);

    await this.userService.updateUser(userId, {
      password: hashedNewPassword,
    } as any);

    return {
      success: true,
      message: 'Cập nhật mật khẩu mới thành công rùi nhé! 🥰',
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
      throw new BadRequestException('No fields provided for update');
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
