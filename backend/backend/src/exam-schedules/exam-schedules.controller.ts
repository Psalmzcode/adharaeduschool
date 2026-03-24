
import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { ExamSchedulesService } from "./exam-schedules.service";
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Exam Schedules")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard)
@Controller("exam-schedules")
export class ExamSchedulesController {
  constructor(private svc: ExamSchedulesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles("TUTOR", "SCHOOL_ADMIN", "SUPER_ADMIN")
  create(@Request() req, @Body() body: any) { return this.svc.create(req.user.sub, body); }

  @Get("school/:schoolId")
  @UseGuards(RolesGuard)
  @Roles("SCHOOL_ADMIN", "TUTOR", "SUPER_ADMIN")
  forSchool(@Param("schoolId") id: string) { return this.svc.getForSchool(id); }

  @Get("mine")
  @UseGuards(RolesGuard)
  @Roles("STUDENT", "PARENT")
  mine(@Request() req) {
    return this.svc.getMine(req.user.sub, req.user.role);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("TUTOR", "SCHOOL_ADMIN", "SUPER_ADMIN")
  update(@Param("id") id: string, @Body() body: any) { return this.svc.update(id, body); }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles("TUTOR", "SCHOOL_ADMIN", "SUPER_ADMIN")
  cancel(@Param("id") id: string) { return this.svc.cancel(id); }
}
