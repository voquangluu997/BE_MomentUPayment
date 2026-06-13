import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class AppleLoginDto {
  @ApiProperty({ description: 'Identity Token do Apple trả về từ phía Client' })
  @IsNotEmpty()
  @IsString()
  identityToken: string;

  @ApiPropertyOptional({
    description: 'Họ tên user (Apple chỉ trả về ở lần đăng nhập đầu tiên)',
  })
  @IsOptional()
  name?: {
    firstName?: string;
    lastName?: string;
  };
}
