import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NoticesService } from './notices.service';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Notices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard)
@Controller('notices')
export class NoticesController {
  constructor(private noticesService: NoticesService) {}

  @Get()
  findAll(@Query('schoolId') schoolId: string) {
    return this.noticesService.findAll(schoolId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  create(@Body() body: any, @Request() req) {
    return this.noticesService.create({ ...body, createdBy: req.user.sub });
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  update(@Param('id') id: string, @Body() body: any) {
    return this.noticesService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  delete(@Param('id') id: string) {
    return this.noticesService.delete(id);
  }
}
