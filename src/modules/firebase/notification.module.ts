// src/modules/notification/notification.module.ts
import { Module } from '@nestjs/common';
import { FirebaseAdminService } from './firebase-admin.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule], // Nếu FirebaseAdminService cần PrismaService
  providers: [FirebaseAdminService],
  exports: [FirebaseAdminService], // 👈 CỰC KỲ QUAN TRỌNG: Phải export thì mới dùng ở nơi khác được
})
export class NotificationModule {}
