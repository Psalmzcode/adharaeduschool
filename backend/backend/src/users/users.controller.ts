import { Controller, Get, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  AllowIncompleteTutorProfile,
  JwtAuthGuard,
  RolesGuard,
  Roles,
  TutorOnboardingGuard,
} from '../auth/guards/jwt-auth.guard';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  findAll(@Query('role') role?: string, @Query('search') search?: string) {
    return this.usersService.findAll({ role, search });
  }

  @Patch('me')
  @AllowIncompleteTutorProfile()
  updateProfile(@Request() req, @Body() body: any) {
    return this.usersService.updateProfile(req.user.sub, body);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id/active')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  setActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.usersService.setActive(id, isActive);
  }
}
