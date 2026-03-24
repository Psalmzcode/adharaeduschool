import { Controller, Post, Delete, Get, Param, Query, UploadedFile, UseInterceptors, UseGuards, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { AllowIncompleteTutorProfile, JwtAuthGuard, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Uploads')
@ApiBearerAuth()
@AllowIncompleteTutorProfile()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
    @Query('entityType') entityType = 'general',
    @Query('entityId') entityId?: string,
  ) {
    return this.uploadsService.uploadFile(file, req.user.sub, entityType, entityId);
  }

  @Delete(':publicId')
  delete(@Param('publicId') publicId: string) {
    return this.uploadsService.deleteFile(decodeURIComponent(publicId));
  }

  @Get()
  getByEntity(@Query('entityType') entityType: string, @Query('entityId') entityId: string) {
    return this.uploadsService.getUploadsByEntity(entityType, entityId);
  }
}
