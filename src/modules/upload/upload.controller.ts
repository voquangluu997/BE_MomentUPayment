import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
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
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const imageUrl = await this.uploadService.uploadImage(file);

    // Trả về đúng cấu trúc JSON mà Flutter Repository đang chờ: { "url": "..." }
    return { url: imageUrl };
  }
}
