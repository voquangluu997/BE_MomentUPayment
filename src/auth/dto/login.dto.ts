import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'congchua@gmail.com',
    description: 'Email tài khoản dùng để đăng nhập',
  })
  @IsEmail({}, { message: 'Email không đúng định dạng rồi nè! 🌸' })
  @IsNotEmpty({ message: 'Không được để trống Email đâu nhé!' })
  email!: string;

  @ApiProperty({
    example: '123456',
    description: 'Mật khẩu bí mật',
  })
  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự nha!' })
  @IsNotEmpty({ message: 'Không được bỏ trống mật khẩu đâu nha! 🔑' })
  @MinLength(4, { message: 'Mật khẩu phải dài từ 4 ký tự trở lên cơ!' })
  password!: string;
}
