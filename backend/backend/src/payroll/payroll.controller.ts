import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
@Roles('SUPER_ADMIN')
@Controller('payroll')
export class PayrollController {
  constructor(private service: PayrollService) {}

  @Get()
  findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get('summary')
  summary(@Query('year') year: string) { return this.service.getSummary(+year || new Date().getFullYear()); }

  @Post('calculate')
  calculate(@Body() body: { tutorId: string; schoolId: string; month: number; year: number }) {
    return this.service.calculate(body.tutorId, body.schoolId, body.month, body.year);
  }

  @Patch(':id/mark-paid')
  markPaid(@Param('id') id: string) { return this.service.markPaid(id); }
}
