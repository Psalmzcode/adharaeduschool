
import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { AssignmentsService } from "./assignments.service";
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Assignments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard)
@Controller("assignments")
export class AssignmentsController {
  constructor(private svc: AssignmentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles("TUTOR", "SCHOOL_ADMIN")
  create(@Request() req, @Body() body: any) { return this.svc.create(req.user.sub, body); }

  @Get("class")
  @UseGuards(RolesGuard)
  @Roles("TUTOR", "SCHOOL_ADMIN", "SUPER_ADMIN")
  forClass(@Query("schoolId") schoolId: string, @Query("className") className: string) {
    return this.svc.getForClass(schoolId, className);
  }

  @Get("mine")
  @UseGuards(RolesGuard)
  @Roles("STUDENT", "PARENT")
  mine(@Request() req) {
    // JWT `sub` is User.id; service resolves Student by userId or by Student.id if `studentId` is ever added to the token.
    return this.svc.getForStudent(req.user.studentId || req.user.sub);
  }

  @Post(":id/submit")
  @UseGuards(RolesGuard)
  @Roles("STUDENT")
  submit(@Param("id") id: string, @Request() req, @Body() body: { fileUrl?: string; notes?: string }) {
    return this.svc.submit(id, req.user.studentId || req.user.sub, body.fileUrl, body.notes);
  }

  @Get(":id/submissions")
  @UseGuards(RolesGuard)
  @Roles("TUTOR", "SCHOOL_ADMIN", "SUPER_ADMIN")
  submissions(@Param("id") id: string) { return this.svc.getSubmissions(id); }

  @Patch("submissions/:id/grade")
  @UseGuards(RolesGuard)
  @Roles("TUTOR")
  grade(@Param("id") id: string, @Body() body: { grade: number; feedback: string }) {
    return this.svc.grade(id, body.grade, body.feedback);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("TUTOR", "SCHOOL_ADMIN")
  update(@Param("id") id: string, @Body() body: any) { return this.svc.update(id, body); }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles("TUTOR", "SCHOOL_ADMIN", "SUPER_ADMIN")
  delete(@Param("id") id: string) { return this.svc.delete(id); }
}
