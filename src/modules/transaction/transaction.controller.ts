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
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  @ApiOperation({ summary: 'Ghi lại một khoản chi tiêu mới' })
  @ApiBody({ type: CreateTransactionDto })
  async create(@Req() req: any, @Body() createTransactionDto: CreateTransactionDto) {
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng!');
    }
    // 💡 ĐÃ SỬA: Thêm await để đợi xử lý hoàn tất từ Service
    return await this.transactionService.create(userId, createTransactionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách lịch sử chi tiêu của tài khoản hiện tại' })
  async findAll(@Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng!');
    }
    // 💡 ĐÃ SỬA: Thêm await đảm bảo không lỗi unresolved Promise
    return await this.transactionService.findAllByUser(userId);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Lấy dữ liệu thống kê chi tiêu theo danh mục của tháng hiện tại' })
  async getAnalytics(@Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng!');
    }
    return await this.transactionService.getAnalytics(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa một giao dịch chi tiêu cũ' })
  async remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundException('Không tìm thấy thông tin định danh người dùng!');
    }

    // 💡 ĐÃ SỬA: Nếu ID giao dịch của bạn trong schema Prisma là String (UUID) giống userId, 
    // hãy bỏ bọc 'Number()' đi và truyền trực tiếp 'id' sang dạng String. 
    // Ở đây tôi giữ tạm Number(id), nếu DB của bạn là String hãy đổi thành: this.transactionService.remove(id, userId)
    const transactionId = isNaN(Number(id)) ? id : Number(id);
    return await this.transactionService.remove(transactionId as any, userId);
  }
}