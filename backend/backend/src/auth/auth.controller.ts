import {
  Controller,
  Post,
  Get,
  Body,
  Request,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AllowIncompleteTutorProfile, JwtAuthGuard, TutorOnboardingGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register school admin + school' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login — returns JWT + user profile' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, TutorOnboardingGuard)
  @AllowIncompleteTutorProfile()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  getMe(@Request() req) {
    return this.authService.getMe(req.user.sub);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard, TutorOnboardingGuard)
  @AllowIncompleteTutorProfile()
  @ApiBearerAuth()
  changePassword(@Request() req, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.sub, dto.oldPassword, dto.newPassword);
  }
}
