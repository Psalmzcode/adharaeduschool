import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class StartSchoolTermDto {
  @IsString()
  academicYearLabel: string;

  @IsInt()
  @Min(1)
  @Max(3)
  termOrdinal: number;

  /** Clone active tutor assignments into the new term (default true). */
  @IsOptional()
  @IsBoolean()
  cloneTutorAssignments?: boolean;

  /** Set all students' termLabel to the new term (default true). */
  @IsOptional()
  @IsBoolean()
  updateStudentTermLabels?: boolean;
}
