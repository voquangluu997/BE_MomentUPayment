import {
  Controller,
  Post,
  Delete,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { extname } from 'path'; // ✨ Import thêm extname để check đuôi file

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      // 🛡️ CHỐT CHẶN 1: Giới hạn dung lượng file (Ví dụ: 5MB)
      limits: {
        fileSize: 5 * 1024 * 1024, // 5 Megabytes
      },
      // 🛡️ CHỐT CHẶN 2: Lọc loại file (Chỉ cho phép ảnh)
      fileFilter: (req, file, callback) => {
        // Kiểm tra Mime Type (Định dạng mà file tự xưng)
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/jpg',
        ];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Từ chối nhận! Chỉ chấp nhận file ảnh (JPG, PNG, WEBP).',
            ),
            false,
          );
        }

        // Kiểm tra thêm đuôi file thực tế (Đề phòng đổi đuôi ngụy trang)
        const ext = extname(file.originalname).toLowerCase();
        const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
        if (!allowedExts.includes(ext)) {
          return callback(
            new BadRequestException('Định dạng đuôi ảnh không hợp lệ!'),
            false,
          );
        }

        // Nếu vượt qua mọi bài kiểm tra, cho phép file đi tiếp
        callback(null, true);
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    const userId = req.user?.id;

    if (!userId) {
      throw new NotFoundException(
        'Không tìm thấy thông tin định danh người dùng!',
      );
    }

    // Bắt lỗi nếu file bị chặn bởi giới hạn dung lượng và bị Multer hủy (lúc này file = undefined)
    if (!file) {
      throw new BadRequestException(
        'File không hợp lệ hoặc dung lượng vượt quá giới hạn 5MB!',
      );
    }

    const imageUrl = await this.uploadService.uploadImage(file, userId);
    return { url: imageUrl };
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  async deleteFile(@Body('imageUrl') imageUrl: string, @Req() req: any) {
    const userId = req.user?.id;

    if (!userId) {
      throw new NotFoundException(
        'Không tìm thấy thông tin định danh người dùng!',
      );
    }

    if (!imageUrl) {
      throw new BadRequestException('Vui lòng cung cấp URL ảnh cần xóa!');
    }

    await this.uploadService.deleteImage(imageUrl);

    return {
      statusCode: 200,
      message: 'Đã dọn dẹp ảnh rác thành công!',
    };
  }
}
