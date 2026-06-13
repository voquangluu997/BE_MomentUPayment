import { Module, Global } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter'; // 🚀 Import thay cho Bull
import { MailProcessor } from './mail.listener';

@Global()
@Module({
  imports: [
    // Đăng ký EventEmitter nếu bạn chưa đăng ký ở app.module.ts
    // Nếu đã đăng ký ở app.module.ts rồi thì không cần dòng này ở đây nữa.
    EventEmitterModule.forRoot(),
  ],
  providers: [MailProcessor],
  exports: [MailProcessor],
})
export class MailModule {}
