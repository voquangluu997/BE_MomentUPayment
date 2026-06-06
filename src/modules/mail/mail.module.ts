import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MailProcessor } from './mail.processor'; // Processor của bạn

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'mail-queue',
    }),
  ],
  providers: [MailProcessor],
  exports: [BullModule, MailProcessor],
})
export class MailModule {}
