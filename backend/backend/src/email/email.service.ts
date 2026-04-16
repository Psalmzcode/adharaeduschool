import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
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
} from './templates';

const RESEND_API_URL = 'https://api.resend.com/emails';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resendApiKey: string;
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    this.resendApiKey = (this.config.get<string>('RESEND_API_KEY') || '').trim();

    if (!this.resendApiKey) {
      this.transporter = nodemailer.createTransport({
        host: config.get('SMTP_HOST', 'smtp.gmail.com'),
        port: config.get<number>('SMTP_PORT', 587),
        secure: false,
        auth: {
          user: config.get('SMTP_USER'),
          pass: config.get('SMTP_PASS'),
        },
      });
    } else {
      this.logger.log('Email: using Resend REST API (HTTPS)');
    }
  }

  /** From address for SMTP (Gmail, etc.). */
  private fromSmtp(): string {
    return `"AdharaEdu" <${this.config.get('SMTP_USER', 'noreply@adharaedu.com')}>`;
  }

  /**
   * From address for Resend — must be a verified domain/sender in Resend.
   * https://resend.com/docs/dashboard/domains/introduction
   */
  private fromResend(): string {
    return (
      this.config.get<string>('RESEND_FROM')?.trim() ||
      this.config.get<string>('EMAIL_FROM')?.trim() ||
      'AdharaEdu <onboarding@resend.dev>'
    );
  }

  private async sendWithResend(to: string | string[], subject: string, html: string) {
    const recipients = Array.isArray(to) ? to : [to];
    const { data } = await axios.post<{ id?: string }>(
      RESEND_API_URL,
      {
        from: this.fromResend(),
        to: recipients,
        subject,
        html,
      },
      {
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );
    this.logger.log(`Resend email queued: id=${data?.id ?? 'n/a'} to=${recipients.join(', ')} subject=${subject}`);
  }

  async send(to: string | string[], subject: string, html: string) {
    try {
      if (this.resendApiKey) {
        await this.sendWithResend(to, subject, html);
      } else {
        if (!this.transporter) {
          this.logger.error('Email: not configured (set RESEND_API_KEY or SMTP_*)');
          return;
        }
        await this.transporter.sendMail({ from: this.fromSmtp(), to, subject, html });
        this.logger.log(`Email sent to ${to}: ${subject}`);
      }
    } catch (err: any) {
      const msg = err?.response?.data ? JSON.stringify(err.response.data) : err?.message;
      this.logger.error(`Failed to send email to ${to}: ${msg}`);
      // Don't throw — email failure should never break the API
    }
  }

  /** OTP / verification code (Resend, Gmail SMTP, etc.). */
  async sendOtp(data: {
    email: string;
    code: string;
    firstName?: string;
    expiresMinutes?: number;
    purpose?: string;
  }) {
    const html = templateOtp({
      code: data.code,
      firstName: data.firstName,
      expiresMinutes: data.expiresMinutes,
      purpose: data.purpose,
    });
    await this.send(data.email, 'Your AdharaEdu verification code', html);
  }

  /** New tutor account — onboarding + KYC before school assignment. */
  async sendTutorWelcome(data: {
    email: string;
    firstName: string;
    loginUrl: string;
    onboardingUrl: string;
    temporaryPassword: string;
  }) {
    await this.send(
      data.email,
      'Welcome to AdharaEdu — complete your tutor onboarding',
      templateTutorWelcome(data),
    );
  }

  async sendStudentWelcome(data: {
    email: string;
    username?: string;
    firstName: string;
    lastName: string;
    regNumber: string;
    schoolName: string;
    track: string;
    className: string;
    password: string;
    loginUrl: string;
  }) {
    await this.send(
      data.email,
      `Welcome to AdharaEdu — ${data.schoolName}`,
      templateStudentWelcome({
        email: data.email,
        username: data.username,
        firstName: data.firstName,
        schoolName: data.schoolName,
        regNumber: data.regNumber,
        password: data.password,
        track: data.track,
        className: data.className,
        loginUrl: data.loginUrl,
      }),
    );
  }

  async sendExamReminder(data: {
    email: string;
    firstName: string;
    examTitle: string;
    date: string;
    time: string;
    venue: string;
    durationMins: number;
    accessCode?: string;
    loginUrl: string;
  }) {
    await this.send(data.email, `Exam Tomorrow: ${data.examTitle}`, templateExamReminder(data));
  }

  async sendExamResult(data: {
    email: string;
    firstName: string;
    examTitle: string;
    score: number;
    totalQuestions: number;
    correct: number;
    passed: boolean;
    loginUrl: string;
  }) {
    await this.send(data.email, `Your Results Are Ready — ${data.examTitle}`, templateExamResult(data));
  }

  async sendPaymentReceipt(data: {
    email: string;
    schoolName: string;
    amount: number;
    description: string;
    reference: string;
    paidAt: Date;
    loginUrl: string;
  }) {
    await this.send(
      data.email,
      `Payment Confirmed — ₦${data.amount.toLocaleString()}`,
      templatePaymentReceipt(data),
    );
  }

  async sendAssignmentNotice(data: {
    email: string;
    firstName: string;
    assignmentTitle: string;
    className: string;
    dueDate: string;
    description: string;
    loginUrl: string;
  }) {
    await this.send(data.email, `New Assignment: ${data.assignmentTitle}`, templateAssignmentNotice(data));
  }

  async sendSchoolApproved(data: {
    email: string;
    schoolName: string;
    adminName: string;
    loginUrl: string;
  }) {
    await this.send(
      data.email,
      `Your School is Approved — Welcome to AdharaEdu!`,
      templateSchoolApproved(data),
    );
  }

  async sendSchoolPendingApproval(data: {
    email: string;
    schoolName: string;
    adminName: string;
    supportEmail?: string;
  }) {
    await this.send(
      data.email,
      `Your AdharaEdu school account is pending approval`,
      templateSchoolPendingApproval(data),
    );
  }

  async sendReportSubmitted(data: {
    email: string;
    tutorName: string;
    schoolName: string;
    weekStart: string;
    weekEnd: string;
    loginUrl: string;
  }) {
    await this.send(
      data.email,
      `Weekly Report Submitted — ${data.tutorName}`,
      templateReportSubmitted(data),
    );
  }

  async sendCertificateReady(data: {
    email: string;
    firstName: string;
    trackName: string;
    averageScore: number;
    serialNumber: string;
    pdfUrl?: string | null;
    studentPortalUrl: string;
  }) {
    await this.send(
      data.email,
      `Your AdharaEdu Certificate is Ready — ${data.trackName}`,
      templateCertificateReady(data),
    );
  }

  async sendPayrollProcessed(data: {
    email: string;
    firstName: string;
    monthLabel: string;
    schoolName: string;
    netAmount: number;
    totalSessions: number;
  }) {
    await this.send(
      data.email,
      `Payroll Processed — ${data.monthLabel}`,
      templatePayrollProcessed(data),
    );
  }

  /** Paystack webhook confirmation to school admins. */
  async sendPaystackPaymentConfirmation(data: {
    email: string | string[];
    schoolName: string;
    amount: number;
    description: string;
    reference: string;
  }) {
    await this.send(
      data.email,
      `Payment Confirmed: ${data.description}`,
      templatePaystackConfirmation(data),
    );
  }
}
