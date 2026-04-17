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
import { ValidateEmailDto } from './dto/validate-email.dto';
import { VerifyRegistrationOtpDto } from './dto/verify-registration-otp.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
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

  @Post('validate-email')
  @ApiOperation({
    summary: 'Check email domain before signup (DNS MX / host — not mailbox proof)',
    description:
      'Returns ok:true if the domain can receive mail. Use on the registration form so users can fix typos before submit.',
  })
  validateEmail(@Body() dto: ValidateEmailDto) {
    return this.authService.validateEmailForSignup(dto.email);
  }

  @Post('otp/verify-registration')
  @ApiOperation({
    summary: 'Verify 6-digit code from school registration email — returns registrationToken for POST /auth/register',
  })
  verifyRegistrationOtp(@Body() dto: VerifyRegistrationOtpDto) {
    return this.authService.verifyRegistrationOtp(dto.email, dto.code);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login — returns JWT + user profile' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('otp/send')
  @ApiOperation({
    summary: 'Request a 6-digit sign-in code by email',
    description:
      'Sends an OTP to the address if a matching active account exists. Response is always the same to avoid email enumeration.',
  })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  @Post('otp/verify')
  @ApiOperation({
    summary: 'Verify email code — returns JWT + user (same shape as login)',
  })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
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
