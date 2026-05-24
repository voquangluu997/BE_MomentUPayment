import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({ example: 55000, description: 'Số tiền đã chi tiêu' })
  @IsNumber({}, { message: 'Số tiền chi tiêu phải là số nha bạn ơi! 🪙' })
  @Min(0, { message: 'Số tiền không được âm đâu nè!' })
  @IsNotEmpty({ message: 'Cho mình xin số tiền bạn đã chi nhé!' })
  amount!: number;

  @ApiPropertyOptional({
    example: 'Mua một ly trà sữa matcha béo ngậy 🍵',
    description: 'Ghi chú chi tiêu',
  })
  @IsString({ message: 'Ghi chú phải là chuỗi ký tự nha!' })
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({
    example: 'https://api.goldtrack.com/public/uploads/bill.jpg',
    description: 'Đường dẫn ảnh hóa đơn',
  })
  @IsString({ message: 'Đường dẫn ảnh không hợp lệ!' })
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ example: 'Food', description: 'Danh mục chi tiêu' })
  @IsString({ message: 'Danh mục phải là chuỗi ký tự nha!' })
  @IsNotEmpty({ message: 'Chọn giúp mình một danh mục chi tiêu nhé! 📂' })
  category!: string;

  @ApiPropertyOptional({
    example: '🍰',
    description: 'Emoji đại diện cho danh mục',
  })
  @IsString({ message: 'Emoji phải là ký tự icon đáng yêu nha!' })
  @IsOptional()
  emoji?: string;
}
