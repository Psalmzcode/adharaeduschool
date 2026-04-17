import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateEmailDto {
  @ApiProperty({ example: 'admin@school.edu.ng' })
  @IsString()
  @IsEmail()
  email: string;
}
