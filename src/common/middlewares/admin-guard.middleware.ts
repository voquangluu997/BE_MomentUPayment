import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AdminGuardMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers['x-admin-key'];
    if (apiKey !== process.env.ADMIN_SECRET_KEY) {
      throw new UnauthorizedException(
        'Bạn không có quyền truy cập trang quản trị!',
      );
    }
    next();
  }
}
