// dto/fcm-token.dto.ts
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  fcmToken: string;

  @IsString()
  @IsOptional()
  language?: string; // 🌐 Có thể là 'vi', 'en',... nếu không truyền sẽ lấy default của DB
}
