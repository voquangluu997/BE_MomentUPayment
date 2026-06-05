import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BadgesController } from './badge.controller';
import { BadgesService } from './badge.service';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  // Import PrismaModule (hoặc module chứa PrismaService của bạn)
  imports: [PrismaModule, NotificationModule],
  controllers: [BadgesController],
  providers: [BadgesService],
  exports: [BadgesService],
})
export class BadgesModule {}
