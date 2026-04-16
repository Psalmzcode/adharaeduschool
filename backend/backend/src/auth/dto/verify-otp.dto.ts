import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, Matches } from 'class-validator';
import { OtpPurpose } from '@prisma/client';

export class VerifyOtpDto {
  @ApiProperty({ example: 'admin@adharaedu.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '482915' })
  @Matches(/^\d{6}$/, { message: 'Code must be exactly 6 digits' })
  code!: string;

  @ApiPropertyOptional({ enum: OtpPurpose, default: OtpPurpose.SIGN_IN })
  @IsOptional()
  @IsEnum(OtpPurpose)
  purpose?: OtpPurpose;
}
