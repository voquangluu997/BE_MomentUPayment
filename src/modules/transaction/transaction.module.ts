import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { PrismaModule } from '../../prisma/prisma.module'; // Đảm bảo đường dẫn import đúng
import { UploadModule } from '../upload/upload.module'; // ✨ THÊM IMPORT NÀY

@Module({
  imports: [PrismaModule, UploadModule], // Kích hoạt Prisma để tương tác DB
  controllers: [TransactionController],
  providers: [TransactionService],
})
export class TransactionModule {}
