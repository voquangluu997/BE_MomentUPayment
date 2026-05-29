import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @ApiProperty({
    example: 'oldpassword123',
    description: 'Mật khẩu cũ đang dùng',
  })
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({
    example: 'newpassword123',
    description: 'Mật khẩu mới muốn thay đổi',
  })
  @MinLength(4, { message: 'Mật khẩu mới phải từ 4 ký tự trở lên' })
  @IsNotEmpty()
  newPassword: string;
}
