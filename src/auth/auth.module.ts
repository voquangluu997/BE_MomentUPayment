import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service'; // 🌸 THÊM IMPORT NÀY (Khai báo đường dẫn tới file service)
import { UserService } from '../users/user.service';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule, // Kích hoạt tương tác DB trực tiếp cho JwtStrategy
    // 1. Đăng ký Passport với chiến lược mặc định là JWT
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // 3. Đăng ký cấu hình JwtService có sẵn của NestJS
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: process.env.JWT_SECRET || 'fallback_secret_key',
        signOptions: { expiresIn: '7d' }, // Token có hạn 7 ngày
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, // 🌸 ĐÃ SỬA: Đăng ký AuthService ở đây để Controller có thể Inject (Tiêm) vào được!
    UserService,
    JwtStrategy,
  ],
  exports: [
    AuthService, // 🌸 THÊM: Xuất luôn AuthService ra ngoài phòng trường hợp sau này Module khác cần dùng tới nó
    UserService,
    PassportModule,
    JwtStrategy,
  ],
})
export class AuthModule {}
