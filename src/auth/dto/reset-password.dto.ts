import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456', description: 'Mã xác thực OTP 6 số' })
  @IsNotEmpty()
  otp: string;

  @ApiProperty({ example: 'newpassword123', description: 'Mật khẩu mới' })
  @MinLength(6, { message: 'Mật khẩu mới phải từ 6 ký tự trở lên' })
  @IsNotEmpty()
  newPassword: string;
}
