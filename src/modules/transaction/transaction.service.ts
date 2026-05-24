import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) {}

  /**
   * ✨ Tạo một giao dịch chi tiêu mới
   */
  async create(userId: number, dto: CreateTransactionDto) {
    return this.prisma.transaction.create({
      data: {
        amount: dto.amount,
        note: dto.note,
        imageUrl: dto.imageUrl,
        category: dto.category,
        emoji: dto.emoji ?? '🌸', // Nếu không gửi emoji, mặc định tặng bông hoa pastel
        userId: userId,
      },
    });
  }

  /**
   * ✨ Lấy toàn bộ lịch sử chi tiêu của riêng user đang đăng nhập
   */
  async findAllByUser(userId: number) {
    return this.prisma.transaction.findMany({
      where: { userId: userId },
      orderBy: { spentAt: 'desc' }, // Giao dịch mới nhất xếp lên đầu
    });
  }

  /**
   * 🗑️ Xóa một giao dịch (Bổ sung để người dùng có thể sửa sai)
   */
  async remove(userId: number, id: number) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: id, userId: userId },
    });

    if (!transaction) {
      throw new NotFoundException('Không tìm thấy giao dịch này của bạn mất rồi! 🔍');
    }

    return this.prisma.transaction.delete({
      where: { id: id },
    });
  }
}