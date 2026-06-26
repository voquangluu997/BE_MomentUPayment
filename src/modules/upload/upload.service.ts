import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class UploadService {
  constructor(@Inject('CLOUDINARY') private readonly cloudinary) {}

  async uploadImage(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    if (!file) throw new BadRequestException('Không tìm thấy file ảnh!');

    // 1. Kiểm tra định dạng file (chỉ cho phép hình ảnh)
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Chỉ chấp nhận tệp tin hình ảnh!');
    }

    if (!userId) throw new BadRequestException('Thiếu userId!');

    try {
      return new Promise((resolve, reject) => {
        const uploadStream = this.cloudinary.uploader.upload_stream(
          {
            folder: `moment_u_payment/users/${userId}`,
            resource_type: 'image',
            // Cloudinary sẽ tự động tối ưu hóa định dạng (vd: WebP/AVIF) khi phân phối đến thiết bị
            transformation: [{ quality: 'auto', fetch_format: 'auto' }],
          },
          (error: UploadApiErrorResponse, result: UploadApiResponse) => {
            if (error) {
              console.error('❌ Cloudinary Error:', error);
              return reject(
                new InternalServerErrorException('Lỗi tải ảnh lên Cloudinary'),
              );
            }
            resolve(result.secure_url);
          },
        );

        // 👈 Sử dụng trực tiếp file.buffer do Client gửi lên
        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      });
    } catch (error) {
      console.error('❌ Lỗi xử lý luồng ảnh:', error);
      throw new InternalServerErrorException(
        'Lỗi xử lý khi tải ảnh lên server',
      );
    }
  }

  async deleteImage(imageUrl: string): Promise<any> {
    if (!imageUrl) return;

    try {
      const regex = /moment_u_payment\/users\/[^\/]+\/[^.]+/;
      const match = imageUrl.match(regex);

      if (!match) {
        console.warn('⚠️ URL ảnh không hợp lệ để xóa:', imageUrl);
        return;
      }

      const publicId = match[0];
      const result = await this.cloudinary.uploader.destroy(publicId);

      if (result.result === 'not_found') {
        console.warn('⚠️ Ảnh không tồn tại trên Cloudinary:', publicId);
      }

      return result;
    } catch (error) {
      console.error('❌ Delete Error:', error);
      throw new InternalServerErrorException(
        'Không thể xóa ảnh trên Cloudinary',
      );
    }
  }
}
