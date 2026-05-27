import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule], // Kích hoạt Prisma để tương tác DB
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
