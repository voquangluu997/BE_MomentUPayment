import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'; // Đường dẫn có thể điều chỉnh tùy dự án của bạn
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@ApiTags('Transactions 🍰') // Gắn nhãn phân nhóm đẹp đẽ trên Swagger
@ApiBearerAuth() // Khai báo bắt buộc có Token trên Swagger
@UseGuards(JwtAuthGuard) // Bảo vệ toàn bộ các endpoint trong Controller này
@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  @ApiOperation({ summary: 'Ghi lại một khoản chi tiêu mới' })
  @ApiBody({ type: CreateTransactionDto })
  create(@Req() req: any, @Body() createTransactionDto: CreateTransactionDto) {
    // req.user được điền tự động sau khi vượt qua JwtAuthGuard thành công
    const userId = req.user.id;
    return this.transactionService.create(userId, createTransactionDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách lịch sử chi tiêu của tài khoản hiện tại',
  })
  findAll(@Req() req: any) {
    const userId = req.user.id;
    return this.transactionService.findAllByUser(userId);
  }

  @Delete(':id')
async remove(@Param('id') id: string, @Req() req: any) {
  // Lấy userId từ JWT ra (thường là string từ payload token)
  const userId = req.user?.id;
  
  if (!userId) {
    throw new NotFoundException('Không tìm thấy thông tin định danh người dùng!');
  }

  // 🔥 Chuyển đổi cả Transaction ID (id) và User ID (userId) từ string sang number
  return this.transactionService.remove(Number(id), Number(userId));
}
}
