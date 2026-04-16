import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { OtpPurpose } from '@prisma/client';

export class RequestOtpDto {
  @ApiProperty({ example: 'admin@adharaedu.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: OtpPurpose, default: OtpPurpose.SIGN_IN })
  @IsOptional()
  @IsEnum(OtpPurpose)
  purpose?: OtpPurpose;
}
