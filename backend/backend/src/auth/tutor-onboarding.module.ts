import { Global, Module } from '@nestjs/common';
import { TutorOnboardingGuard } from './guards/jwt-auth.guard';

@Global()
@Module({
  providers: [TutorOnboardingGuard],
  exports: [TutorOnboardingGuard],
})
export class TutorOnboardingModule {}
