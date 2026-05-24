import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(data: RegisterDto) {
    const userExists = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (userExists)
      throw new BadRequestException('Email đã tồn tại rùi nè! 💕');

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: { email: data.email, password: hashedPassword, name: data.name },
    });

    return this.generateToken(user.id);
  }

  async login(data: any) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (!user)
      throw new UnauthorizedException(
        'Sai email hoặc mật khẩu mất tiêu rồi! 😢',
      );

    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid)
      throw new UnauthorizedException(
        'Sai email hoặc mật khẩu mất tiêu rồi! 😢',
      );

    return this.generateToken(user.id);
  }

  private generateToken(userId: number) {
    return {
      access_token: this.jwtService.sign({ userId }),
    };
  }
}
