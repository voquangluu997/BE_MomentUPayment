import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@ApiTags('Transactions 🍰')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  @ApiOperation({ summary: 'Ghi lại một khoản chi tiêu mới' })
  @ApiBody({ type: CreateTransactionDto })
  create(@Req() req: any, @Body() createTransactionDto: CreateTransactionDto) {
    // req.user.id hiện tại là một chuỗi string (UUID)
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

  @Get('analytics')
  @ApiOperation({
    summary: 'Lấy dữ liệu thống kê chi tiêu theo danh mục của tháng hiện tại',
  })
  async getAnalytics(@Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng!');
    }

    // ✨ ĐÃ SỬA: Truyền trực tiếp chuỗi string userId xuống Service, không bọc qua Number() nữa
    return this.transactionService.getAnalytics(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa một giao dịch chi tiêu cũ' })
  async remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;

    if (!userId) {
      throw new NotFoundException(
        'Không tìm thấy thông tin định danh người dùng!',
      );
    }

    // ✨ ĐÃ SỬA: Giữ nguyên Number(id) cho ID giao dịch và truyền chuỗi userId dạng string nguyên bản
    return this.transactionService.remove(Number(id), userId);
  }
}
