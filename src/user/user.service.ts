import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Đường dẫn tùy thuộc vào cấu trúc dự án của bạn

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByVerificationToken(token: string) {
    return this.prisma.user.findUnique({
      where: { verificationToken: token },
    });
  }

  async findById(id: string) {
    // hoặc id: number tùy thuộc vào kiểu dữ liệu của bạn
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async createUser(data: {
    email: string;
    password?: string;
    name?: string;
    avatar?: string;
    googleId?: string;
    verificationToken?: string;
    isEmailVerified?: boolean;
  }) {
    return this.prisma.user.create({
      data,
    });
  }

  async updateUser(userId: string, data: any) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}
