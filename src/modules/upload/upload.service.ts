import { Injectable, BadRequestException } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class UploadService {
  /**
   * 🚀 Hàm tiếp nhận file ảnh từ Controller, biến đổi sang dạng Stream
   * và đẩy thẳng lên hệ thống lưu trữ đám mây Cloudinary.
   */
  async uploadImage(file: Express.Multer.File): Promise<string> {
    // 1. Kiểm tra xem file thô truyền từ Flutter lên có tồn tại không
    if (!file) {
      throw new BadRequestException(
        'Không tìm thấy file ảnh nào được gửi lên!',
      );
    }

    // 2. Trả về một Promise xử lý tác vụ upload bất đồng bộ
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'moment_u_payment', // Tạo thư mục quản lý ảnh riêng cho app trên Cloudinary
          resource_type: 'image', // Xác định kiểu tài nguyên là hình ảnh
        },
        (error: UploadApiErrorResponse, result: UploadApiResponse) => {
          if (error) {
            console.error('❌ Lỗi chi tiết khi đẩy ảnh lên Cloudinary:', error);
            return reject(
              new BadRequestException(
                'Đẩy ảnh lên đám mây Cloudinary thất bại!',
              ),
            );
          }

          // ✨ Thành công: Trả về đường dẫn URL bảo mật (định dạng https)
          resolve(result.secure_url);
        },
      );

      // 3. Biến đổi dữ liệu Buffer của file trong bộ nhớ RAM thành luồng Stream
      // để pipe (đổ thẳng) vào luồng upload của Cloudinary mà không tốn dung lượng ổ cứng server
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}
