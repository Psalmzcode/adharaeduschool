import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SchoolType, TrackLevel } from '@prisma/client';

/**
 * School onboarding draft — same fields as CompleteSchoolProfileDto but ALL optional.
 * Does NOT set profileCompletedAt.
 */
export class SaveSchoolProfileDraftDto {
  @ApiPropertyOptional({ example: 'Crown Heights Secondary School' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  officialName?: string;

  @ApiPropertyOptional({ enum: SchoolType })
  @IsOptional()
  @IsEnum(SchoolType)
  schoolType?: SchoolType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsEmail()
  officialEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  officialPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  principalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  principalPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ictContactName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ictContactPhone?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsEmail()
  ictContactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billingContactName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsEmail()
  billingContactEmail?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billingContactPhone?: string;

  @ApiPropertyOptional({ type: [String], example: ['JSS1', 'JSS2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platformLevels?: string[];

  @ApiPropertyOptional({ enum: TrackLevel, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(TrackLevel, { each: true })
  enrolledTracks?: TrackLevel[];

  @ApiPropertyOptional({ example: 'Second Term' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  currentTermLabel?: string;

  @ApiPropertyOptional({ example: '2025/2026' })
  @IsOptional()
  @IsString()
  @MinLength(4)
  academicYearLabel?: string;

  @ApiPropertyOptional({ example: '100 – 300' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  studentCountBand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  streamsCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  visitDeploymentNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ enum: ['Africa/Lagos'] })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locale?: string;
}

