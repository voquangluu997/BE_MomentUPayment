import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import redisConfig from './config/redis.config';
import { ReportsModule } from './reports/reports.module';
import { AdminGuardMiddleware } from './common/middlewares/admin-guard.middleware';
import { AuthModule } from './auth/auth.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { UserModule } from './users/user.module';
import { ScheduleModule } from '@nestjs/schedule';
import { BudgetCronService } from './modules/firebase/budget-cron.service';
import { FirebaseNotificationModule } from './modules/firebase/firebase-notification.module';
import { NotificationModule } from './modules/notifications/notification.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, load: [redisConfig] }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
          tls: configService.get('redis.tls'),
        },
      }),
      inject: [ConfigService],
    }),
    // Cấu hình BullBoard toàn cục
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),

    AuthModule,
    TransactionModule,
    ReportsModule,
    UserModule,
    NotificationModule,
    FirebaseNotificationModule
  ],
  providers: [BudgetCronService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Sửa từ '/admin/queues*' thành '/admin/queues/(.*)'
    consumer.apply(AdminGuardMiddleware).forRoutes('/admin/queues/*path');
  }
}
