import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';
import { TracksService } from './tracks.service';

@ApiTags('Tracks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
@Controller('tracks')
export class TracksController {
  constructor(private readonly service: TracksService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TUTOR')
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @Roles('SUPER_ADMIN')
  create(@Body() body: any) {
    return this.service.create({
      code: body.code,
      name: body.name,
      description: body.description,
      isActive: body.isActive,
    });
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }
}

