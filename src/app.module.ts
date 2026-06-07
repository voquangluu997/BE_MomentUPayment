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
import { HealthModule } from './health/health.module';
import { BadgesModule } from './modules/badges/badge.module';
import { MailModule } from './modules/mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [redisConfig] }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST');
        const port = configService.get<string>('REDIS_PORT');
        const password = configService.get<string>('REDIS_PASSWORD');
        const useTLS = configService.get<string>('REDIS_TLS') === '1';

        // 1. Fallback cho local nếu quên không set file .env
        if (!host) {
          console.log(
            '⚠️ Không tìm thấy REDIS_HOST. Chạy tự động với localhost.',
          );
          return {
            redis: { host: 'localhost', port: 6379 },
          };
        }

        // 2. Cấu hình mặc định
        const redisConfig: any = {
          host,
          port: parseInt(port, 10) || 6379,
          retryStrategy: (times: number) => Math.min(times * 50, 2000),
          maxRetriesPerRequest: 3,
        };

        // 3. Xử lý Auth thông minh: Chỉ thêm user/pass NẾU file .env có password (tức là đang chạy Upstash)
        if (password) {
          redisConfig.password = password;
          redisConfig.username =
            configService.get<string>('REDIS_USERNAME') || 'default';
        }

        // 4. Xử lý TLS cho Production
        if (useTLS) {
          redisConfig.tls = { rejectUnauthorized: false };
        }

        return {
          redis: redisConfig,
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
            removeOnFail: false,
          },
        };
      },
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
    FirebaseNotificationModule,
    HealthModule,
    BadgesModule,
    MailModule,
  ],
  providers: [BudgetCronService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Sửa từ '/admin/queues*' thành '/admin/queues/(.*)'
    consumer.apply(AdminGuardMiddleware).forRoutes('/admin/queues/*path');
  }
}
