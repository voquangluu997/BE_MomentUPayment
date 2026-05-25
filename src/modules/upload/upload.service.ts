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

  /**
   * 🔥 Hàm trích xuất public_id từ URL Cloudinary và tiến hành xóa file
   * @param imageUrl URL đầy đủ của ảnh (ví dụ: https://res.cloudinary.com/.../moment_u_payment/abc123xyz.jpg)
   */
  async deleteImage(imageUrl: string): Promise<any> {
    if (!imageUrl) return;

    try {
      // 1. Tìm và cắt chuỗi để lấy phần public_id nằm sau thư mục root của dự án
      // Ví dụ URL: https://res.cloudinary.com/demo/image/upload/v123456/moment_u_payment/sample1.jpg
      // public_id cần lấy để xóa sẽ là: "moment_u_payment/sample1" (bỏ phần đuôi mở rộng .jpg/.png)
      const folderName = 'moment_u_payment';
      const startIndex = imageUrl.indexOf(folderName);

      if (startIndex === -1) {
        throw new BadRequestException(
          'URL ảnh không thuộc hệ thống quản lý của ứng dụng!',
        );
      }

      const endIndex = imageUrl.lastIndexOf('.');
      const publicId = imageUrl.substring(startIndex, endIndex);

      // 2. Gọi lệnh thông qua Cloudinary SDK để xóa tận gốc file trên đám mây
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
