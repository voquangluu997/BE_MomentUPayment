import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'fallback_secret_key',
    });
  }

  async validate(payload: { userId: any }) {
    // Đổi thành any để bắt mọi kiểu dữ liệu từ token cũ
    if (!payload || !payload.userId) {
      throw new UnauthorizedException(
        'Token không hợp lệ hoặc thiếu thông tin!',
      );
    }

    // 🌸 ĐÃ SỬA: Ép kiểu userId một cách tường minh thành String để khớp với Schema Prisma
    const userIdStr = String(payload.userId);
    const user = await this.prisma.user.findUnique({
      where: {
        id: userIdStr,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isEmailVerified: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User không tồn tại hoặc token hết hạn.');
    }

    return user;
  }
}
