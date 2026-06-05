// src/modules/firebase/firebase-notification.module.ts
import { Module } from '@nestjs/common';
import { FirebaseAdminService } from './firebase-admin.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule], // Nếu FirebaseAdminService cần PrismaService
  providers: [FirebaseAdminService],
  exports: [FirebaseAdminService],
})
export class FirebaseNotificationModule {}
