import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { UploadModule } from './modules/upload/upload.module';

@Module({
  imports: [PrismaModule, AuthModule, TransactionModule, UploadModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
