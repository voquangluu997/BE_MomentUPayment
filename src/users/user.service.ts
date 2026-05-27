import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Đường dẫn tùy thuộc vào cấu trúc dự án của bạn
import { UpdateBudgetDto } from './dto/update-budget.dto';

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

  async updateBudget(userId: string, dto: UpdateBudgetDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(
        'Không tìm thấy người dùng này rồi u là trời! 😿',
      );
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { budgetLimit: dto.budgetLimit },
      select: {
        id: true,
        budgetLimit: true,
      },
    });
  }

  async getBudgetSummary(userId: string) {
    // 1. Lấy hạn mức ngân sách của User
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { budgetLimit: true },
    });

    // 2. Tính ngày đầu tháng và cuối tháng hiện tại (Tháng 5/2026)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    // 3. Tính tổng chi tiêu (EXPENSE) trong tháng này của User
    const aggregateSpent = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        userId: userId,
        spentAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    return {
      budgetLimit: user?.budgetLimit || 0,
      totalSpent: aggregateSpent._sum.amount || 0,
    };
  }
}
