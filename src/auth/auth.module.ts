import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { MailProcessor } from './mail.processor';
import { UserService } from '../user/user.service'; // Import thêm UserService của bạn

@Module({
  imports: [
    // Đăng ký hàng đợi Redis
    BullModule.registerQueue({
      name: 'mail-queue',
    }),
    // Đăng ký cấu hình JwtService có sẵn của NestJS
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'fallback_secret_key',
      signOptions: { expiresIn: '7d' }, // Token hết hạn trong 7 ngày
    }),
  ],
  controllers: [AuthController],
  providers: [MailProcessor, UserService], // Thêm UserService vào đây để khởi tạo
  exports: [UserService],
})
export class AuthModule {}
