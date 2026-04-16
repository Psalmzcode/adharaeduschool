import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class LoginDto {
  /** Email address or username (students). Filled from `email` when omitted (legacy clients). */
  @ApiProperty({ example: 'admin@school.edu.ng or chr.aisha' })
  @Transform(({ obj }) => {
    const l = obj.login;
    if (l != null && String(l).trim() !== '') return String(l).trim();
    if (obj.email != null && String(obj.email).trim() !== '') return String(obj.email).trim();
    return '';
  })
  @IsString()
  @MinLength(1)
  login: string;

  /** @deprecated Send `login` instead — still accepted */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty()
  @IsString()
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() oldPassword: string;
  @ApiProperty() @IsString() @MinLength(8) newPassword: string;
}
