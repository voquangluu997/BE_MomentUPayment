import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/logger/winston.config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      // ✨ Cấu hình nâng cấp: Gộp các lỗi validation thành một câu thông báo mượt mà
      exceptionFactory: (errors) => {
        const messages = errors.map((error) =>
          Object.values(error.constraints || {}).join('. '),
        );
        return new BadRequestException(messages.join('. '));
      },
    }),
  );
  // ✨ Cấu hình mở cổng thư mục tĩnh công khai
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.enableCors({
    origin: [
      'http://localhost:8001', // Cổng chạy Local của chính Backend (nếu cần test)
      'http://localhost:10000', // Cổng chạy Local của Flutter Web khi dev
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  const config = new DocumentBuilder()
    .setTitle('Moments U Payment API')
    .setDescription(
      'Tài liệu API tích hợp hệ thống ví điện tử Moments U Payment',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Nhập Token của bạn vào đây (Không cần gõ chữ Bearer)',
        in: 'header',
      },
      'JWT-auth', // Tên key bảo mật để dùng với decorator @ApiBearerAuth() trong Controller
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Cấu hình endpoint truy cập tài liệu API là /api
  SwaggerModule.setup('api', app, document);
  // ---------------------------------
  await app.listen(process.env.PORT ?? 8001, '0.0.0.0');
  console.log(
    `🚀 Application is running on: http://localhost:${process.env.PORT || 8001}/api`,
  );
}
bootstrap();
