import { Module, Global } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Global() // Thêm @Global() để các module khác (như BudgetModule) dùng luôn không cần import lại
@Module({
  imports: [PrismaModule],
  controllers: [NotificationController],
  providers: [NotificationService, FirebaseAdminService],
  exports: [FirebaseAdminService, NotificationService], // Xuất khẩu ra ngoài để nơi khác "hưởng sái"
})
export class NotificationModule {}