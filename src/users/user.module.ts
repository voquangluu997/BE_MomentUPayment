import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { FirebaseAdminService } from 'src/modules/firebase/firebase-admin.service';

@Module({
  imports: [PrismaModule], // Kích hoạt Prisma để tương tác DB
  controllers: [UserController],
  providers: [UserService, PrismaService, FirebaseAdminService],
  exports: [UserService],
})
export class UserModule {}
