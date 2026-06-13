import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter'; // Thêm thư viện này

import { ReportsModule } from './reports/reports.module';
import { AuthModule } from './auth/auth.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { UserModule } from './users/user.module';
import { BudgetCronService } from './modules/firebase/budget-cron.service';
import { FirebaseNotificationModule } from './modules/firebase/firebase-notification.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { HealthModule } from './health/health.module';
import { BadgesModule } from './modules/badges/badge.module';
import { MailModule } from './modules/mail/mail.module';

@Module({
  imports: [
    // Bỏ load redisConfig
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    // Thay thế BullModule bằng EventEmitterModule
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),

    AuthModule,
    TransactionModule,
    ReportsModule,
    UserModule,
    NotificationModule,
    FirebaseNotificationModule,
    HealthModule,
    BadgesModule,
    MailModule,
  ],
  providers: [BudgetCronService],
})
// Bỏ luôn NestModule và MiddlewareConsumer vì không còn dùng BullBoard
export class AppModule {}
