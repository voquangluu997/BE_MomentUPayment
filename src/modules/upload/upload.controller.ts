import { 
  Controller, 
  Post, 
  UseInterceptors, 
  UploadedFile, 
  BadRequestException, 
  UseGuards 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@ApiTags('Upload 📸')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard) // Chỉ cho phép user đã đăng nhập upload ảnh hóa đơn
@Controller('upload')
export class UploadController {
  
  @Post()
  @ApiOperation({ summary: 'Tải ảnh hóa đơn/khoảnh khắc chi tiêu lên hệ thống' })
  @ApiConsumes('multipart/form-data') // Khai báo kiểu gửi nhận file cho Swagger
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        // Nơi lưu trữ file tạm thời trên server cục bộ
        destination: './public/uploads',
        filename: (req, file, callback) => {
          // Tạo tên file độc nhất: lồng ghép timestamp và chuỗi ngẫu nhiên
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `moment-${uniqueSuffix}${ext}`);
        },
      }),
      // Bộ lọc định dạng file: Chỉ chấp nhận ảnh
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return callback(new BadRequestException('Định dạng ảnh không hợp lệ rùi! Chỉ nhận jpg, jpeg, png, webp thôi nha 🌸'), false);
        }
        callback(null, true);
      },
      // Giới hạn dung lượng file ảnh tối đa (ví dụ: 5MB)
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Hình như bạn chưa chọn ảnh để tải lên nè! 🔎');
    }

    // Trả về đường dẫn tương đối của ảnh để lưu vào DB ở Bước 4
    // Ví dụ: /uploads/moment-123456.jpg
    const fileUrl = `/uploads/${file.filename}`;
    
    return {
      message: 'Tải ảnh lên thành công rùi nè! ✨',
      imageUrl: fileUrl,
    };
  }
}