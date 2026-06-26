import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import * as streamifier from 'streamifier';
import sharp from 'sharp';

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
      // 🚀 NÉN ẢNH TRƯỚC KHI UPLOAD VỚI SHARP
      const compressedBuffer = await sharp(file.buffer)
        .resize({
          width: 800, // Thu nhỏ chiều rộng tối đa về 800px (phù hợp cho avatar/ảnh cover)
          withoutEnlargement: true, // Tránh việc ảnh nhỏ bị phóng to làm mờ
        })
        .jpeg({ quality: 80 }) // Chuyển đổi sang chuẩn jpeg và nén chất lượng còn 80%
        .toBuffer();

      return new Promise((resolve, reject) => {
        const uploadStream = this.cloudinary.uploader.upload_stream(
          {
            folder: `moment_u_payment/users/${userId}`,
            resource_type: 'image',
            // Cloudinary sẽ tiếp tục tự động tối ưu hóa định dạng (vd: WebP) khi phân phối
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

        // 👈 Sử dụng compressedBuffer thay vì file.buffer gốc
        streamifier.createReadStream(compressedBuffer).pipe(uploadStream);
      });
    } catch (error) {
      console.error('❌ Lỗi nén ảnh:', error);
      throw new InternalServerErrorException(
        'Lỗi xử lý và nén ảnh trước khi tải lên',
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
      const result = await cloudinary.uploader.destroy(publicId);

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
