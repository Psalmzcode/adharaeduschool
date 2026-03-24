import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@school.edu.ng' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() oldPassword: string;
  @ApiProperty() @IsString() @MinLength(8) newPassword: string;
}
