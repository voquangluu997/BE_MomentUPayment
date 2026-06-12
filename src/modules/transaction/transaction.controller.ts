import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  Req,
  NotFoundException,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
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
  async create(
    @Req() req: any,
    @Body() createTransactionDto: CreateTransactionDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng!');
    }
    return await this.transactionService.create(userId, createTransactionDto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Lấy danh sách lịch sử chi tiêu của tài khoản hiện tại (Có phân trang)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
    description: 'Số trang',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 15,
    description: 'Số phần tử mỗi trang',
  })
  async findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng!');
    }
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return await this.transactionService.findAllByUser(
      userId,
      pageNum,
      limitNum,
    );
  }

  @Get('analytics')
  @ApiOperation({
    summary: 'Lấy dữ liệu thống kê toàn diện (Danh mục, Splurges, Insights)',
  })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
  async getAnalytics(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng!');
    }
    // API này giờ sẽ trả về { categories, biggestSplurges, diaryInsight }
    return await this.transactionService.getAnalytics(
      userId,
      startDate,
      endDate,
    );
  }

  // =========================================================================
  // ✨ NEW API: SEE ALL BIGGEST SPLURGES
  // =========================================================================
  @Get('splurges')
  @ApiOperation({
    summary:
      'Lấy toàn bộ danh sách chi tiêu khủng (Hall of Fame) có phân trang',
  })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
    description: 'Số trang',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 20,
    description: 'Số phần tử mỗi trang',
  })
  async getAllSplurges(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng!');
    }

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return await this.transactionService.getAllSplurges(
      userId,
      startDate,
      endDate,
      pageNum,
      limitNum,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin giao dịch' })
  @ApiBody({ type: CreateTransactionDto })
  async update(
    @Param('id') id: string,
    @Body() updateTransactionDto: CreateTransactionDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng!');
    }

    const transactionId = isNaN(Number(id)) ? id : Number(id);

    return await this.transactionService.update(
      transactionId as any,
      userId,
      updateTransactionDto,
    );
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

    const transactionId = isNaN(Number(id)) ? id : Number(id);
    return await this.transactionService.remove(transactionId as any, userId);
  }
}
