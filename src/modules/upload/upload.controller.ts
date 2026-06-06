import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseGuards(JwtAuthGuard) // Bảo vệ endpoint, chỉ user đã login mới được up ảnh
  @UseInterceptors(FileInterceptor('file')) // Khớp với key 'file' phía Flutter gửi lên
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundException(
        'Không tìm thấy thông tin định danh người dùng!',
      );
    }
    const imageUrl = await this.uploadService.uploadImage(file, userId);
    return { url: imageUrl };
  }
}
