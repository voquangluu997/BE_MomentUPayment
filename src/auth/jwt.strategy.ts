import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

// Định nghĩa cấu trúc rõ ràng cho dữ liệu giải mã từ JWT Token (Payload)
interface JwtPayload {
  userId: number;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET ?? 'default_fallback_secret_key_pinky',
    });
  }

  // Phương thức này tự động chạy sau khi token được xác thực tính hợp lệ thành công
  async validate(payload: JwtPayload) {
    // Tìm kiếm user nhưng KHÔNG lấy trường password để bảo mật dữ liệu
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        budgetLimit: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Tài khoản không tồn tại hoặc đã bị khóa rùi! 😢',
      );
    }

    // Giá trị trả về ở đây sẽ được NestJS tự động gán vào đối tượng Request (req.user)
    return user;
  }
}
