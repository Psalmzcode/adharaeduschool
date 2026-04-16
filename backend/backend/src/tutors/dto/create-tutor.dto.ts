import { Transform } from 'class-transformer';
import { IsArray, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTutorDto {
  @IsString()
  @MinLength(1)
  @Transform(({ value }) => String(value ?? '').trim())
  firstName!: string;

  @IsString()
  @MinLength(1)
  @Transform(({ value }) => String(value ?? '').trim())
  lastName!: string;

  @IsEmail()
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  email!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim())
  phone?: string;

  @IsOptional()
  @IsArray()
  specializations?: string[];

  @IsOptional()
  @IsArray()
  tracks?: any[];
}

