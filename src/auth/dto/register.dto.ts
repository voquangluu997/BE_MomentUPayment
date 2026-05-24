import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'congchua@gmail.com',
    description: 'Email đăng ký tài khoản',
  })
  @IsEmail({}, { message: 'Email không đúng định dạng rồi nè! 🌸' })
  @IsNotEmpty({ message: 'Không được để trống Email đâu nhé!' })
  email!: string;

  @ApiProperty({
    example: '123456',
    description: 'Mật khẩu bí mật (tối thiểu 4 ký tự)',
  })
  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự nha!' })
  @MinLength(4, { message: 'Mật khẩu phải dài từ 4 ký tự trở lên cơ! 🔑' })
  password!: string;

  @ApiProperty({
    example: 'Miu Miu 🌸',
    description: 'Tên hiển thị trên ứng dụng',
  })
  @IsString({ message: 'Tên hiển thị phải là chuỗi ký tự nha!' })
  @IsNotEmpty({ message: 'Cho mình xin cái tên hiển thị dễ thương nhé!' })
  @Length(1, 40, {
    message: 'Tên dễ thương ngắn thôi nè, từ 1 đến 40 ký tự thôi nha! 💕',
  })
  name!: string;
}
