// src/common/guards/admin.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-admin-key'];

    // Kiểm tra API Key từ môi trường
    if (apiKey !== process.env.ADMIN_SECRET_KEY) {
      throw new UnauthorizedException('Bạn không có quyền truy cập!');
    }
    return true;
  }
}
