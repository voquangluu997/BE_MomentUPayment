import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'fallback_secret_key',
    });
  }

  async validate(payload: { userId: string }) {
    // Đảm bảo userId ở đây là string
    // Tìm kiếm user dựa trên ID lấy từ mã JWT
    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.userId, // Hết lỗi vì id và payload.userId đã cùng là string
      },
      select: {
        id: true,
        email: true,
        name: true,
        isEmailVerified: true, // Lấy thêm trạng thái này để truyền vào req.user nếu cần
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or invalid token.');
    }

    return user; // Dữ liệu này sẽ được gán vào req.user ở Controller
  }
}
