import { v2 as cloudinary } from 'cloudinary';
import { InternalServerErrorException } from '@nestjs/common';

export const CloudinaryProvider = {
  provide: 'CLOUDINARY',
  useFactory: () => {
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new InternalServerErrorException(
        'Cloudinary configuration is missing in environment variables!',
      );
    }
    return cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  },
};
