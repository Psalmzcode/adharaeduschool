import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SchoolType, TrackLevel } from '@prisma/client';

export class CompleteSchoolProfileDto {
  /// Shown in dashboard header; defaults to official name if omitted
  @ApiPropertyOptional({ example: 'Crown Heights Secondary School' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty() @IsString() @MinLength(2) officialName: string;

  @ApiProperty({ enum: SchoolType }) @IsEnum(SchoolType) schoolType: SchoolType;

  @ApiPropertyOptional() @IsOptional() @IsString() website?: string;

  @ApiProperty() @IsEmail() officialEmail: string;

  @ApiProperty() @IsString() @MinLength(5) officialPhone: string;

  @ApiProperty() @IsString() @MinLength(2) principalName: string;

  @ApiProperty() @IsString() @MinLength(5) principalPhone: string;

  @ApiPropertyOptional() @IsOptional() @IsString() ictContactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ictContactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v != null && String(v).trim() !== '') @IsEmail() ictContactEmail?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() billingContactName?: string;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v != null && String(v).trim() !== '') @IsEmail() billingContactEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() billingContactPhone?: string;

  @ApiProperty({ type: [String], example: ['JSS1', 'JSS2', 'SS1'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  platformLevels: string[];

  @ApiProperty({ enum: TrackLevel, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(TrackLevel, { each: true })
  enrolledTracks: TrackLevel[];

  @ApiProperty({ example: 'First Term' })
  @IsString()
  @MinLength(2)
  currentTermLabel: string;

  @ApiProperty({ example: '2025/2026' })
  @IsString()
  @MinLength(4)
  academicYearLabel: string;

  @ApiProperty({ example: '100 – 300' })
  @IsString()
  @MinLength(2)
  studentCountBand: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() streamsCount?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() visitDeploymentNotes?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;

  @ApiPropertyOptional({ enum: ['Africa/Lagos'] }) @IsOptional() @IsString() timezone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() locale?: string;
}
