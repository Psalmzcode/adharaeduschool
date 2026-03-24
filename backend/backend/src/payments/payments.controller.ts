import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  findAll(@Query('schoolId') schoolId?: string) {
    return this.paymentsService.findAll(schoolId);
  }

  @Get('summary')
  @Roles('SUPER_ADMIN')
  getSummary() {
    return this.paymentsService.getSummary();
  }

  @Post()
  @Roles('SUPER_ADMIN')
  create(@Body() body: any) {
    return this.paymentsService.create(body);
  }

  @Patch(':id/paid')
  @Roles('SUPER_ADMIN')
  markPaid(@Param('id') id: string, @Body('receiptUrl') receiptUrl?: string) {
    return this.paymentsService.markPaid(id, receiptUrl);
  }
}
