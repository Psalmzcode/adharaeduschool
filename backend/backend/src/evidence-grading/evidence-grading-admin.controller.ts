import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard } from '../auth/guards/jwt-auth.guard';
import { EvidenceGradingAdminService } from './evidence-grading-admin.service';

@ApiTags('Evidence Grading')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('evidence-grading')
export class EvidenceGradingAdminController {
  constructor(private readonly service: EvidenceGradingAdminService) {}

  @Get('admin/oversight')
  @Roles('SUPER_ADMIN')
  oversight() {
    return this.service.getOversight();
  }
}
