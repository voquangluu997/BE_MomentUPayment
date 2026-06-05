import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BadgesController } from './badge.controller';
import { BadgesService } from './badge.service';

@Module({
  // Import PrismaModule (hoặc module chứa PrismaService của bạn)
  imports: [PrismaModule],
  controllers: [BadgesController],
  providers: [BadgesService],
  exports: [BadgesService],
})
export class BadgesModule {}
