import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UploadsService {
  constructor(private config: ConfigService, private prisma: PrismaService) {
    cloudinary.config({
      cloud_name: this.config.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.get('CLOUDINARY_API_KEY'),
      api_secret: this.config.get('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    uploadedBy: string,
    entityType: string,
    entityId?: string,
    folder = 'adharaedu',
  ): Promise<{ url: string; publicId: string }> {
    if (!file) throw new BadRequestException('No file provided');

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `${folder}/${entityType}`,
          resource_type: 'auto',
          transformation:
            entityType === 'avatar' ? [{ width: 200, height: 200, crop: 'fill', gravity: 'face' }] : undefined,
        },
        async (error, result) => {
          if (error) return reject(new BadRequestException(error.message));
          // Save record
          await this.prisma.upload.create({
            data: {
              publicId: result.public_id,
              url: result.secure_url,
              resourceType: result.resource_type,
              uploadedBy,
              entityType,
              entityId,
            },
          });
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      uploadStream.end(file.buffer);
    });
  }

  async deleteFile(publicId: string) {
    await cloudinary.uploader.destroy(publicId);
    await this.prisma.upload.deleteMany({ where: { publicId } });
    return { deleted: true };
  }

  async getUploadsByEntity(entityType: string, entityId: string) {
    return this.prisma.upload.findMany({ where: { entityType, entityId }, orderBy: { createdAt: 'desc' } });
  }
}
