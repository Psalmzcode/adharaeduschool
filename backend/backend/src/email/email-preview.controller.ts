import { Controller, Get, Param, ForbiddenException, NotFoundException, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  templateAssignmentNotice,
  templateCertificateReady,
  templateExamReminder,
  templateExamResult,
  templateOtp,
  templatePayrollProcessed,
  templatePaymentReceipt,
  templatePaystackConfirmation,
  templateReportSubmitted,
  templateSchoolApproved,
  templateSchoolPendingApproval,
  templateStudentWelcome,
  templateTutorWelcome,
} from './templates/transactional';

const DEMO_BASE = 'https://app.adharaedu.com';

const PREVIEW_HTML: Record<string, () => string> = {
  'school-approved': () =>
    templateSchoolApproved({
      adminName: 'Jake Lewis',
      schoolName: 'City Comprehensive Secondary School',
      loginUrl: DEMO_BASE,
    }),
  'school-pending': () =>
    templateSchoolPendingApproval({
      adminName: 'Jake Lewis',
      schoolName: 'City Comprehensive Secondary School',
      supportEmail: 'support@adharaedu.com',
    }),
  otp: () =>
    templateOtp({
      code: '123456',
      firstName: 'there',
      expiresMinutes: 10,
      purpose: 'verify your email and complete your school registration',
    }),
  'tutor-welcome': () =>
    templateTutorWelcome({
      firstName: 'Amaka',
      email: 'tutor@example.com',
      loginUrl: DEMO_BASE,
      onboardingUrl: `${DEMO_BASE}/dashboard/tutor`,
      temporaryPassword: 'Tutor@123',
    }),
  'student-welcome': () =>
    templateStudentWelcome({
      firstName: 'Aisha',
      schoolName: 'Crown Heights Secondary School',
      regNumber: 'CHR-2026-001',
      username: 'chr.aisha',
      email: 'aisha@crownheights.edu.ng',
      password: 'student@021',
      track: 'TRACK_3',
      className: 'SS3A',
      loginUrl: DEMO_BASE,
    }),
  'exam-reminder': () =>
    templateExamReminder({
      firstName: 'Aisha',
      examTitle: 'Module 2 CBT',
      date: 'Monday, 21 April 2026',
      time: '10:00 AM',
      venue: 'Computer Lab A',
      durationMins: 45,
      accessCode: 'ADH-8821',
      loginUrl: DEMO_BASE,
    }),
  'exam-result': () =>
    templateExamResult({
      firstName: 'Aisha',
      examTitle: 'Module 2 CBT',
      score: 82,
      totalQuestions: 40,
      correct: 33,
      passed: true,
      loginUrl: DEMO_BASE,
    }),
  'payment-receipt': () =>
    templatePaymentReceipt({
      schoolName: 'Crown Heights Secondary School',
      amount: 250000,
      description: 'Term 2 — 50 students',
      reference: 'PAY-ADH-2026-001',
      paidAt: new Date('2026-04-15T12:00:00Z'),
      loginUrl: DEMO_BASE,
    }),
  'assignment-notice': () =>
    templateAssignmentNotice({
      firstName: 'Aisha',
      assignmentTitle: 'Build a landing page',
      className: 'SS3A',
      dueDate: 'Friday, 25 April 2026',
      description: 'Submit a link to your hosted page.',
      loginUrl: DEMO_BASE,
    }),
  'report-submitted': () =>
    templateReportSubmitted({
      tutorName: 'Kemi Obi',
      schoolName: 'Crown Heights Secondary School',
      weekStart: '7 Apr 2026',
      weekEnd: '13 Apr 2026',
      loginUrl: DEMO_BASE,
    }),
  'certificate-ready': () =>
    templateCertificateReady({
      firstName: 'Aisha',
      trackName: 'Track 3 — Full Stack',
      averageScore: 88,
      serialNumber: 'ADH-CERT-2026-SEED-AISHA',
      pdfUrl: 'https://example.com/cert.pdf',
      studentPortalUrl: DEMO_BASE,
    }),
  'payroll-processed': () =>
    templatePayrollProcessed({
      firstName: 'Kemi',
      monthLabel: 'April 2026',
      schoolName: 'Crown Heights Secondary School',
      netAmount: 120000,
      totalSessions: 12,
    }),
  'paystack-confirmation': () =>
    templatePaystackConfirmation({
      schoolName: 'Crown Heights Secondary School',
      amount: 250000,
      description: 'Term invoice — 50 students',
      reference: 'PAYSTACK-REF-001',
    }),
};

const PREVIEW_ORDER = Object.keys(PREVIEW_HTML);

/**
 * Renders transactional email HTML for design QA (no send).
 * Disabled in production unless `EMAIL_PREVIEW=true`.
 */
@ApiTags('Email')
@Controller('email')
export class EmailPreviewController {
  constructor(private readonly config: ConfigService) {}

  private assertPreviewAllowed(): void {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    if (isProd && this.config.get<string>('EMAIL_PREVIEW') !== 'true') {
      throw new ForbiddenException(
        'Email preview is disabled in production. Set EMAIL_PREVIEW=true in .env to enable.',
      );
    }
  }

  @Get('preview')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'List all email template previews (HTML links)' })
  previewIndex(): string {
    this.assertPreviewAllowed();
    const items = PREVIEW_ORDER.map(
      (id) =>
        `<li style="margin:10px 0;"><a href="./preview/${id}" style="color:#1E7FD4;font-weight:600;font-size:15px;">${id}</a> <span style="color:#8E8E93;font-size:13px;">— sample data</span></li>`,
    ).join('');
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>AdharaEdu — Email previews</title></head>
<body style="margin:0;padding:32px;font-family:system-ui,sans-serif;background:#F2F2F7;color:#1C1C1E;">
  <h1 style="font-size:22px;margin:0 0 8px;">Transactional email previews</h1>
  <p style="margin:0 0 24px;color:#636366;font-size:15px;max-width:560px;">Open any link to verify layout, numbered steps, and CTA buttons. Use <strong>school-approved</strong> for the approval email (Jake Lewis / City Comprehensive Secondary School).</p>
  <ul style="margin:0;padding-left:20px;">${items}</ul>
</body></html>`;
  }

  @Get('preview/:name')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'Render one email template as HTML (sample data)' })
  previewOne(@Param('name') name: string): string {
    this.assertPreviewAllowed();
    const fn = PREVIEW_HTML[name];
    if (!fn) {
      throw new NotFoundException(`Unknown template: ${name}. Available: ${PREVIEW_ORDER.join(', ')}`);
    }
    return fn();
  }
}
