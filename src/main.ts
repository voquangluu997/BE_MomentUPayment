import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/logger/winston.config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  const config = new DocumentBuilder()
    .setTitle('Gold Track VN API')
    .setDescription('Tài liệu API cho hệ thống theo dõi giá vàng và ngoại tệ')
    .setVersion('1.0')
    .addBearerAuth() // Bật hỗ trợ cấu hình Token bảo mật JWT nếu có
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Cấu hình endpoint truy cập tài liệu API là /api
  SwaggerModule.setup('api', app, document);
  // ---------------------------------
  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `🚀 Application is running on: http://localhost:${process.env.PORT || 3000}/api`,
  );
}
bootstrap();
