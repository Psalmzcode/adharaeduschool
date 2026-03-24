import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST', 'smtp.gmail.com'),
      port: config.get<number>('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: config.get('SMTP_USER'),
        pass: config.get('SMTP_PASS'),
      },
    });
  }

  private from() {
    return `"AdharaEdu" <${this.config.get('SMTP_USER', 'noreply@adharaedu.com')}>`;
  }

  async send(to: string | string[], subject: string, html: string) {
    try {
      await this.transporter.sendMail({ from: this.from(), to, subject, html });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);
      // Don't throw — email failure should never break the API
    }
  }

  // ── Student enrollment welcome email ──────────────────────
  async sendStudentWelcome(data: {
    email: string; firstName: string; lastName: string;
    regNumber: string; schoolName: string; track: string;
    className: string; password: string; loginUrl: string;
  }) {
    const trackName = data.track.replace('TRACK_', 'Track ');
    await this.send(data.email, `Welcome to AdharaEdu — ${data.schoolName}`, `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}
  .card{background:#fff;border-radius:12px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
  .header{background:linear-gradient(135deg,#050D1A,#0d1e35);padding:32px;text-align:center}
  .logo{font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px}
  .logo span{color:#D4A853}
  .body{padding:32px}
  h2{color:#050D1A;font-size:22px;margin:0 0 8px}
  p{color:#555;line-height:1.7;margin:0 0 16px}
  .cred-box{background:#f8f5ef;border:1px solid #e8e0d0;border-radius:8px;padding:20px;margin:20px 0}
  .cred-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e8e0d0}
  .cred-row:last-child{border-bottom:none}
  .cred-label{color:#888;font-size:13px}
  .cred-value{color:#050D1A;font-weight:700;font-size:14px;font-family:monospace}
  .btn{display:inline-block;background:#1E7FD4;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:8px 0}
  .footer{background:#f8f5ef;padding:20px;text-align:center;font-size:12px;color:#999}
  .badge{display:inline-block;background:rgba(212,168,83,0.15);color:#D4A853;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;border:1px solid rgba(212,168,83,0.3);margin-bottom:20px}
</style></head><body>
<div class="card">
  <div class="header">
    <div class="logo">Adhara<span>Edu</span></div>
    <p style="color:rgba(255,255,255,0.6);margin:8px 0 0;font-size:13px">Learn Smart. Grow Together</p>
  </div>
  <div class="body">
    <div class="badge">${data.schoolName}</div>
    <h2>Welcome, ${data.firstName}! 🎉</h2>
    <p>You have been enrolled in the AdharaEdu Tech Skills Programme. Here are your login credentials — keep them safe.</p>
    <div class="cred-box">
      <div class="cred-row"><span class="cred-label">Registration Number</span><span class="cred-value">${data.regNumber}</span></div>
      <div class="cred-row"><span class="cred-label">Email Address</span><span class="cred-value">${data.email}</span></div>
      <div class="cred-row"><span class="cred-label">Password</span><span class="cred-value">${data.password}</span></div>
      <div class="cred-row"><span class="cred-label">Track</span><span class="cred-value">${trackName}</span></div>
      <div class="cred-row"><span class="cred-label">Class</span><span class="cred-value">${data.className}</span></div>
    </div>
    <p>Log in to your student portal to track your progress, view upcoming exams, and message your tutor.</p>
    <a href="${data.loginUrl}" class="btn">Access Student Portal →</a>
    <p style="font-size:13px;color:#888;margin-top:20px">Please change your password after your first login.</p>
  </div>
  <div class="footer">AdharaEdu · adharaedu.com · adharaEdu0@gmail.com<br>© ${new Date().getFullYear()} AdharaEdu Consultancy & Technology Solutions</div>
</div></body></html>`);
  }

  // ── Exam reminder ─────────────────────────────────────────
  async sendExamReminder(data: {
    email: string; firstName: string; examTitle: string;
    date: string; time: string; venue: string; durationMins: number;
    accessCode?: string; loginUrl: string;
  }) {
    await this.send(data.email, `Exam Tomorrow: ${data.examTitle}`, `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}
  .card{background:#fff;border-radius:12px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
  .header{background:linear-gradient(135deg,#991b1b,#450a0a);padding:32px;text-align:center}
  .logo{font-size:22px;font-weight:900;color:#fff}
  .body{padding:32px}
  h2{color:#050D1A;font-size:22px;margin:0 0 8px}
  p{color:#555;line-height:1.7;margin:0 0 16px}
  .info-box{background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:20px;margin:20px 0}
  .info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #fed7aa}
  .info-row:last-child{border-bottom:none}
  .info-label{color:#888;font-size:13px}
  .info-value{color:#050D1A;font-weight:700;font-size:14px}
  .btn{display:inline-block;background:#dc2626;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px}
  .footer{background:#f8f5ef;padding:20px;text-align:center;font-size:12px;color:#999}
</style></head><body>
<div class="card">
  <div class="header">
    <div style="font-size:48px;margin-bottom:8px">⏰</div>
    <div class="logo">Exam Reminder</div>
  </div>
  <div class="body">
    <h2>Hi ${data.firstName}, your exam is coming up!</h2>
    <p>This is a reminder that you have a CBT examination scheduled.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Exam</span><span class="info-value">${data.examTitle}</span></div>
      <div class="info-row"><span class="info-label">Date</span><span class="info-value">${data.date}</span></div>
      <div class="info-row"><span class="info-label">Time</span><span class="info-value">${data.time}</span></div>
      <div class="info-row"><span class="info-label">Venue</span><span class="info-value">${data.venue}</span></div>
      <div class="info-row"><span class="info-label">Duration</span><span class="info-value">${data.durationMins} minutes</span></div>
      ${data.accessCode ? `<div class="info-row"><span class="info-label">Access Code</span><span class="info-value" style="font-family:monospace">${data.accessCode}</span></div>` : ''}
    </div>
    <p><strong>Please arrive 10 minutes early</strong> with your Student ID. Ensure your device is fully charged.</p>
    <a href="${data.loginUrl}/cbt" class="btn">Go to Exam Portal →</a>
  </div>
  <div class="footer">AdharaEdu · adharaedu.com · © ${new Date().getFullYear()}</div>
</div></body></html>`);
  }

  // ── Exam results ──────────────────────────────────────────
  async sendExamResult(data: {
    email: string; firstName: string; examTitle: string;
    score: number; totalQuestions: number; correct: number;
    passed: boolean; loginUrl: string;
  }) {
    const grade = data.score >= 90 ? 'A+' : data.score >= 80 ? 'A' : data.score >= 70 ? 'B+' : data.score >= 60 ? 'B' : data.score >= 50 ? 'C' : 'F';
    await this.send(data.email, `Your Results Are Ready — ${data.examTitle}`, `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}
  .card{background:#fff;border-radius:12px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
  .header{background:linear-gradient(135deg,${data.passed ? '#14532d,#052e16' : '#7f1d1d,#450a0a'});padding:32px;text-align:center}
  .score-ring{width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,0.1);margin:0 auto 16px;display:flex;align-items:center;justify-content:center;border:4px solid rgba(255,255,255,0.3)}
  .score{font-size:28px;font-weight:900;color:#fff}
  .body{padding:32px}
  h2{color:#050D1A;font-size:20px;margin:0 0 8px}
  p{color:#555;line-height:1.7;margin:0 0 16px}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0}
  .stat{text-align:center;background:#f8f5ef;border-radius:8px;padding:16px}
  .stat-val{font-size:22px;font-weight:900;color:#050D1A}
  .stat-lbl{font-size:11px;color:#888;margin-top:4px}
  .btn{display:inline-block;background:#1E7FD4;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px}
  .footer{background:#f8f5ef;padding:20px;text-align:center;font-size:12px;color:#999}
  .badge{display:inline-block;padding:6px 16px;border-radius:20px;font-weight:700;font-size:14px;${data.passed ? 'background:rgba(34,197,94,0.2);color:#166534;border:1px solid rgba(34,197,94,0.3)' : 'background:rgba(239,68,68,0.2);color:#991b1b;border:1px solid rgba(239,68,68,0.3)'}}
</style></head><body>
<div class="card">
  <div class="header">
    <div class="score-ring"><div class="score">${data.score}%</div></div>
    <p style="color:rgba(255,255,255,0.8);margin:0;font-size:16px">${data.passed ? 'Congratulations! 🎉' : 'Keep going! 💪'}</p>
  </div>
  <div class="body">
    <h2>Hi ${data.firstName}, your results are ready</h2>
    <p>Here are your results for <strong>${data.examTitle}</strong>:</p>
    <div style="text-align:center;margin:16px 0"><span class="badge">${data.passed ? '✓ PASSED' : '✗ FAILED'} — Grade ${grade}</span></div>
    <div class="stats">
      <div class="stat"><div class="stat-val">${data.score}%</div><div class="stat-lbl">Score</div></div>
      <div class="stat"><div class="stat-val">${data.correct}/${data.totalQuestions}</div><div class="stat-lbl">Correct</div></div>
      <div class="stat"><div class="stat-val">${grade}</div><div class="stat-lbl">Grade</div></div>
    </div>
    <p>${data.passed ? 'Well done! Your result has been recorded. Keep up the excellent work.' : 'Don\'t give up! Review the material and speak to your tutor for support.'}</p>
    <a href="${data.loginUrl}/dashboard/student" class="btn">View Full Results →</a>
  </div>
  <div class="footer">AdharaEdu · adharaedu.com · © ${new Date().getFullYear()}</div>
</div></body></html>`);
  }

  // ── Payment receipt ───────────────────────────────────────
  async sendPaymentReceipt(data: {
    email: string; schoolName: string; amount: number;
    description: string; reference: string; paidAt: Date; loginUrl: string;
  }) {
    await this.send(data.email, `Payment Confirmed — ₦${data.amount.toLocaleString()}`, `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}
  .card{background:#fff;border-radius:12px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
  .header{background:linear-gradient(135deg,#14532d,#052e16);padding:32px;text-align:center;color:#fff}
  .body{padding:32px}
  h2{color:#050D1A;font-size:20px;margin:0 0 8px}
  p{color:#555;line-height:1.7;margin:0 0 16px}
  .receipt-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #bbf7d0}
  .row:last-child{border-bottom:none}
  .lbl{color:#888;font-size:13px}
  .val{color:#050D1A;font-weight:700;font-size:14px}
  .total{font-size:20px;color:#14532d}
  .footer{background:#f8f5ef;padding:20px;text-align:center;font-size:12px;color:#999}
</style></head><body>
<div class="card">
  <div class="header">
    <div style="font-size:48px;margin-bottom:8px">✅</div>
    <h1 style="margin:0;font-size:22px">Payment Confirmed</h1>
  </div>
  <div class="body">
    <h2>Thank you, ${data.schoolName}!</h2>
    <p>Your payment has been received and confirmed. Here is your receipt:</p>
    <div class="receipt-box">
      <div class="row"><span class="lbl">Reference</span><span class="val" style="font-family:monospace">${data.reference}</span></div>
      <div class="row"><span class="lbl">Description</span><span class="val">${data.description}</span></div>
      <div class="row"><span class="lbl">Date</span><span class="val">${data.paidAt.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
      <div class="row"><span class="lbl">Amount Paid</span><span class="val total">₦${data.amount.toLocaleString()}</span></div>
    </div>
    <p>This payment has been applied to your account. View full payment history in your school admin portal.</p>
    <a href="${data.loginUrl}/dashboard/admin" style="display:inline-block;background:#1E7FD4;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Go to Dashboard →</a>
  </div>
  <div class="footer">AdharaEdu · adharaedu.com · © ${new Date().getFullYear()}</div>
</div></body></html>`);
  }

  // ── New assignment notification ───────────────────────────
  async sendAssignmentNotice(data: {
    email: string; firstName: string; assignmentTitle: string;
    className: string; dueDate: string; description: string; loginUrl: string;
  }) {
    await this.send(data.email, `New Assignment: ${data.assignmentTitle}`, `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}
  .card{background:#fff;border-radius:12px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
  .header{background:linear-gradient(135deg,#1e3a8a,#1e40af);padding:32px;text-align:center;color:#fff}
  .body{padding:32px}
  h2{color:#050D1A;font-size:20px;margin:0 0 8px}
  p{color:#555;line-height:1.7;margin:0 0 16px}
  .due-badge{display:inline-block;background:#fef3c7;color:#92400e;padding:6px 16px;border-radius:20px;font-weight:700;font-size:14px;border:1px solid #fde68a;margin:0 0 16px}
  .btn{display:inline-block;background:#1e40af;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px}
  .footer{background:#f8f5ef;padding:20px;text-align:center;font-size:12px;color:#999}
</style></head><body>
<div class="card">
  <div class="header"><div style="font-size:48px;margin-bottom:8px">📝</div><h1 style="margin:0;font-size:20px">New Assignment</h1></div>
  <div class="body">
    <h2>Hi ${data.firstName}!</h2>
    <p>Your tutor has posted a new assignment for <strong>${data.className}</strong>.</p>
    <div class="due-badge">Due: ${data.dueDate}</div>
    <p><strong>${data.assignmentTitle}</strong></p>
    <p>${data.description}</p>
    <a href="${data.loginUrl}/dashboard/student" class="btn">View & Submit Assignment →</a>
  </div>
  <div class="footer">AdharaEdu · adharaedu.com · © ${new Date().getFullYear()}</div>
</div></body></html>`);
  }

  // ── School approval notification ──────────────────────────
  async sendSchoolApproved(data: {
    email: string; schoolName: string; adminName: string; loginUrl: string;
  }) {
    await this.send(data.email, `Your School is Approved — Welcome to AdharaEdu!`, `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}
  .card{background:#fff;border-radius:12px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
  .header{background:linear-gradient(135deg,#050D1A,#0d1e35);padding:32px;text-align:center}
  .logo{font-size:28px;font-weight:900;color:#fff}
  .logo span{color:#D4A853}
  .body{padding:32px}
  h2{color:#050D1A;font-size:22px;margin:0 0 8px}
  p{color:#555;line-height:1.7;margin:0 0 16px}
  .steps{background:#f8f5ef;border-radius:8px;padding:20px;margin:20px 0}
  .step{display:flex;gap:12px;margin-bottom:12px;align-items:flex-start}
  .step-num{width:24px;height:24px;background:#D4A853;color:#050D1A;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0}
  .btn{display:inline-block;background:#1E7FD4;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px}
  .footer{background:#f8f5ef;padding:20px;text-align:center;font-size:12px;color:#999}
</style></head><body>
<div class="card">
  <div class="header"><div class="logo">Adhara<span>Edu</span></div></div>
  <div class="body">
    <h2>🎉 Congratulations, ${data.adminName}!</h2>
    <p><strong>${data.schoolName}</strong> has been approved and is now active on the AdharaEdu platform.</p>
    <div class="steps">
      <p style="font-weight:700;color:#050D1A;margin:0 0 12px">Get started in 3 steps:</p>
      <div class="step"><div class="step-num">1</div><div><strong>Log into your admin portal</strong> and complete your school profile.</div></div>
      <div class="step"><div class="step-num">2</div><div><strong>Add your students</strong> — use individual add or bulk CSV upload.</div></div>
      <div class="step"><div class="step-num">3</div><div><strong>Your assigned tutor will reach out</strong> to schedule the first session.</div></div>
    </div>
    <a href="${data.loginUrl}/dashboard/admin" class="btn">Open Admin Dashboard →</a>
  </div>
  <div class="footer">AdharaEdu · adharaedu.com · © ${new Date().getFullYear()}</div>
</div></body></html>`);
  }

  // ── Report submitted notification (to super admin) ────────
  async sendReportSubmitted(data: {
    email: string; tutorName: string; schoolName: string;
    weekStart: string; weekEnd: string; loginUrl: string;
  }) {
    await this.send(data.email, `Weekly Report Submitted — ${data.tutorName}`, `
<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px">
  <h2 style="color:#050D1A">New Report Submitted</h2>
  <p><strong>${data.tutorName}</strong> has submitted their weekly report for <strong>${data.schoolName}</strong>.</p>
  <p>Period: ${data.weekStart} → ${data.weekEnd}</p>
  <a href="${data.loginUrl}/dashboard/superadmin" style="display:inline-block;background:#1E7FD4;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Review Report →</a>
  <p style="color:#888;font-size:12px;margin-top:20px">AdharaEdu Platform</p>
</div>`);
  }
}
