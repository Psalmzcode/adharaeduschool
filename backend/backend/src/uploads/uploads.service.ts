import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
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

    if (entityType === 'curriculum-lesson' || entityType === 'module-material') {
      const user = await this.prisma.user.findUnique({ where: { id: uploadedBy }, select: { role: true } });
      const ok = user?.role === Role.SUPER_ADMIN || user?.role === Role.CURRICULUM_LEAD;
      if (!ok) {
        throw new ForbiddenException('Only curriculum authors can upload learning materials for modules or lessons');
      }
      if (!String(entityId || '').trim()) {
        throw new BadRequestException('entityId is required for curriculum learning materials');
      }
    }

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

  async getUploadsByEntity(
    entityType: string,
    entityId: string,
    user?: { sub: string; role: string },
  ) {
    if (!String(entityId || '').trim()) {
      throw new BadRequestException('entityId is required');
    }
    if (entityType === 'curriculum-lesson' || entityType === 'module-material') {
      const role = user?.role;
      if (role !== Role.SUPER_ADMIN && role !== Role.CURRICULUM_LEAD) {
        throw new ForbiddenException('Listing curriculum learning materials requires curriculum author access');
      }
    }
    return this.prisma.upload.findMany({ where: { entityType, entityId }, orderBy: { createdAt: 'desc' } });
  }
}
