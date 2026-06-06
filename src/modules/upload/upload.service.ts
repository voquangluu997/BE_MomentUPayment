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
   * 🚀 Upload ảnh ngầm và lưu vào folder riêng của từng User
   */
  async uploadImage(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException(
        'Không tìm thấy file ảnh nào được gửi lên!',
      );
    }

    if (!userId) {
      throw new BadRequestException('Thiếu thông tin userId để tạo thư mục!');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `moment_u_payment/users/${userId}`, // Tạo folder riêng cho user
          resource_type: 'image',
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
          resolve(result.secure_url);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  /**
   * 🔥 Hàm trích xuất public_id từ URL Cloudinary và tiến hành xóa file
   */
  async deleteImage(imageUrl: string): Promise<any> {
    if (!imageUrl) return;

    try {
      // URL ví dụ: https://res.cloudinary.com/.../moment_u_payment/users/123/sample.jpg
      const folderName = 'moment_u_payment';
      const startIndex = imageUrl.indexOf(folderName);

      if (startIndex === -1) {
        throw new BadRequestException(
          'URL ảnh không thuộc hệ thống quản lý của ứng dụng!',
        );
      }

      const endIndex = imageUrl.lastIndexOf('.');
      // Sẽ lấy được toàn bộ chuỗi: "moment_u_payment/users/123/sample"
      const publicId = imageUrl.substring(startIndex, endIndex);

      const result = await cloudinary.uploader.destroy(publicId);

      if (result.result !== 'ok' && result.result !== 'not_found') {
        throw new Error(`Cloudinary trả về trạng thái lỗi: ${result.result}`);
      }

      return result;
    } catch (error) {
      throw new BadRequestException(
        `Không thể xóa ảnh trên Cloudinary: ${error}`,
      );
    }
  }
}
