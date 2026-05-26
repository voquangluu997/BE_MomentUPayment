import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport'; // 🌸 THÊM IMPORT NÀY
import { AuthController } from './auth.controller';
import { MailProcessor } from './mail.processor';
import { UserService } from '../user/user.service';
import { JwtStrategy } from './jwt.strategy'; // 🌸 THÊM IMPORT NÀY
import { PrismaModule } from '../prisma/prisma.module'; // Đảm bảo import thêm PrismaModule nếu JwtStrategy dùng PrismaService trực tiếp
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule, // Kích hoạt tương tác DB trực tiếp cho JwtStrategy
    // 1. Đăng ký Passport với chiến lược mặc định là JWT
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // 2. Đăng ký hàng đợi Redis
    BullModule.registerQueue({
      name: 'mail-queue',
    }),
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
    MailProcessor,
    UserService,
    JwtStrategy, // 🌸 ĐÃ SỬA: Phải đăng ký JwtStrategy làm provider ở đây
  ],
  exports: [
    UserService,
    PassportModule, // 🌸 ĐÃ SỬA: Xuất PassportModule ra để các controller khác hưởng sái cấu hình
    JwtStrategy, // 🌸 ĐÃ SỬA: Xuất JwtStrategy ra ngoài cho các Module khác (như Transaction) sử dụng
  ],
})
export class AuthModule {}
