import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Để dùng ở mọi module khác mà không cần import lại
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}