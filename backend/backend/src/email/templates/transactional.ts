/**
 * Transactional email bodies. Each export returns a **full HTML document** via `emailDocument()`
 * so the OTP header (gradient + logo beside wordmark) matches every other email.
 *
 * Quick map:
 * - `templateOtp` — verification codes
 * - `templateTutorWelcome` — new tutor account; onboarding + KYC before school assignment
 * - `templateSchoolApproved` — school approved for admin
 * - `templateReportSubmitted` — weekly report submitted (**to super admins**, not to tutors)
 * - Plus: student welcome, exam reminder/result, payment, assignment, certificate, payroll, Paystack
 */

import {
  COLORS,
  ctaButton,
  ctaButtonGold,
  emailDocument,
  escapeHtml,
  labelCaps,
  paragraph,
  paragraphHtml,
  separator,
  titleH1,
} from './layout';

/** OTP / verification code — large monospace digits, iOS-style. */
export function templateOtp(data: {
  code: string;
  firstName?: string;
  expiresMinutes?: number;
  purpose?: string;
}): string {
  const digits = data.code.replace(/\D/g, '').slice(0, 8).split('');
  const exp = data.expiresMinutes ?? 10;
  const purpose = data.purpose ?? 'sign in to your account';

  const cells = digits
    .map(
      (d) =>
        `<td style="width:44px;height:52px;text-align:center;vertical-align:middle;background:${COLORS.bg};border-radius:12px;border:1px solid ${COLORS.separator};font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:22px;font-weight:700;color:${COLORS.text};">${escapeHtml(d)}</td>`,
    )
    .join('<td width="8"></td>');

  const plainCode = digits.join('');

  const greet = data.firstName
    ? `Hi ${data.firstName} — use this code to ${purpose}.`
    : `Use this code to ${purpose}.`;
  const inner = `
    ${labelCaps('Verification')}
    ${titleH1('Your verification code')}
    ${paragraph(greet, { muted: true })}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;"><tr>${cells}</tr></table>
    <p style="margin:12px 0 4px;font-size:12px;line-height:1.5;color:${COLORS.secondary};text-align:center;">Copy the full code (select all on one line):</p>
    <p style="margin:0 0 20px;font-size:22px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:0.18em;color:${COLORS.text};text-align:center;-webkit-user-select:all;user-select:all;word-break:break-all;">${escapeHtml(plainCode)}</p>
    <p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:${COLORS.secondary};text-align:center;">This code expires in <strong style="color:${COLORS.text};">${exp} minutes</strong>.</p>
    ${separator()}
    <p style="margin:0;font-size:12px;line-height:1.5;color:${COLORS.secondary};">If you didn’t request this email, you can safely ignore it. Someone may have typed your address by mistake.</p>
  `;

  return emailDocument({
    preheader: `Your code is ${data.code.replace(/\D/g, '').slice(0, 6)} — expires in ${exp} min`,
    children: inner,
  });
}

export function templateStudentWelcome(data: {
  firstName: string;
  schoolName: string;
  regNumber: string;
  username?: string;
  email: string;
  password: string;
  track: string;
  className: string;
  loginUrl: string;
}): string {
  const trackName = data.track.replace('TRACK_', 'Track ');
  const userRow = data.username
    ? `<tr><td style="padding:12px 0;border-bottom:1px solid ${COLORS.separator};"><span style="font-size:13px;color:${COLORS.secondary};">Username</span><br><span style="font-size:15px;font-weight:600;color:${COLORS.text};font-family:ui-monospace,monospace;">${escapeHtml(data.username)}</span></td></tr>`
    : '';

  const inner = `
    ${labelCaps(data.schoolName)}
    ${titleH1(`Welcome, ${data.firstName}!`)}
    ${paragraph('You’re enrolled in the AdharaEdu Tech Skills programme. Save these credentials in a safe place.', { muted: true })}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};border-radius:16px;overflow:hidden;margin:8px 0 20px;">
      <tr><td style="padding:16px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:12px 0;border-bottom:1px solid ${COLORS.separator};"><span style="font-size:13px;color:${COLORS.secondary};">Registration</span><br><span style="font-size:15px;font-weight:600;font-family:ui-monospace,monospace;">${escapeHtml(data.regNumber)}</span></td></tr>
          ${userRow}
          <tr><td style="padding:12px 0;border-bottom:1px solid ${COLORS.separator};"><span style="font-size:13px;color:${COLORS.secondary};">Email</span><br><span style="font-size:15px;font-weight:600;">${escapeHtml(data.email)}</span></td></tr>
          <tr><td style="padding:12px 0;border-bottom:1px solid ${COLORS.separator};"><span style="font-size:13px;color:${COLORS.secondary};">Password</span><br><span style="font-size:15px;font-weight:600;font-family:ui-monospace,monospace;">${escapeHtml(data.password)}</span></td></tr>
          <tr><td style="padding:12px 0;border-bottom:1px solid ${COLORS.separator};"><span style="font-size:13px;color:${COLORS.secondary};">Track</span><br><span style="font-size:15px;font-weight:600;">${escapeHtml(trackName)}</span></td></tr>
          <tr><td style="padding:12px 0;"><span style="font-size:13px;color:${COLORS.secondary};">Class</span><br><span style="font-size:15px;font-weight:600;">${escapeHtml(data.className)}</span></td></tr>
        </table>
      </td></tr>
    </table>
    ${ctaButton(data.loginUrl, 'Open student portal')}
    ${paragraph('Please change your password after your first login.', { small: true, muted: true })}
  `;

  return emailDocument({ preheader: `Welcome to ${data.schoolName} — your login details inside`, children: inner });
}

export function templateExamReminder(data: {
  firstName: string;
  examTitle: string;
  date: string;
  time: string;
  venue: string;
  durationMins: number;
  accessCode?: string;
  loginUrl: string;
}): string {
  const accessBlock = data.accessCode
    ? `<tr><td style="padding:10px 0;"><span style="font-size:13px;color:#8E4A4A;">Access code</span><br><span style="font-size:17px;font-weight:700;font-family:ui-monospace,monospace;letter-spacing:0.12em;">${escapeHtml(data.accessCode)}</span></td></tr>`
    : '';

  const inner = `
    ${labelCaps('Reminder')}
    ${titleH1('Exam tomorrow')}
    ${paragraph(`Hi ${data.firstName} — your CBT exam is scheduled. Arrive 10 minutes early with your student ID.`, { muted: true })}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF5F5;border-radius:16px;border:1px solid #FFE4E4;margin:12px 0 20px;">
      <tr><td style="padding:18px 20px;">
        <table role="presentation" width="100%">
          <tr><td style="padding:10px 0;border-bottom:1px solid #FFD6D6;"><span style="font-size:13px;color:#8E4A4A;">Exam</span><br><span style="font-size:16px;font-weight:700;color:${COLORS.text};">${escapeHtml(data.examTitle)}</span></td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #FFD6D6;"><span style="font-size:13px;color:#8E4A4A;">Date & time</span><br><span style="font-size:16px;font-weight:600;">${escapeHtml(data.date)} · ${escapeHtml(data.time)}</span></td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #FFD6D6;"><span style="font-size:13px;color:#8E4A4A;">Venue</span><br><span style="font-size:16px;font-weight:600;">${escapeHtml(data.venue)}</span></td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid ${data.accessCode ? '#FFD6D6' : 'transparent'};"><span style="font-size:13px;color:#8E4A4A;">Duration</span><br><span style="font-size:16px;font-weight:600;">${data.durationMins} minutes</span></td></tr>
          ${accessBlock}
        </table>
      </td></tr>
    </table>
    ${ctaButton(`${data.loginUrl.replace(/\/$/, '')}/cbt`, 'Go to exam portal')}
  `;

  return emailDocument({ preheader: `${data.examTitle} · ${data.date}`, children: inner });
}

export function templateExamResult(data: {
  firstName: string;
  examTitle: string;
  score: number;
  totalQuestions: number;
  correct: number;
  passed: boolean;
  loginUrl: string;
}): string {
  const grade =
    data.score >= 90 ? 'A+' : data.score >= 80 ? 'A' : data.score >= 70 ? 'B+' : data.score >= 60 ? 'B' : data.score >= 50 ? 'C' : 'F';
  const passColor = data.passed ? COLORS.success : COLORS.danger;
  const inner = `
    ${labelCaps('Results')}
    ${titleH1(data.passed ? 'Great work' : 'Results are in')}
    ${paragraph(`Hi ${data.firstName} — here’s how you did on ${data.examTitle}.`, { muted: true })}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 20px;">
      <tr>
        <td align="center" style="padding:28px 16px;background:${COLORS.bg};border-radius:20px;">
          <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.secondary};margin-bottom:8px;">Score</div>
          <div style="font-size:44px;font-weight:800;letter-spacing:-1px;color:${passColor};line-height:1;">${data.score}<span style="font-size:22px;font-weight:700;">%</span></div>
          <div style="margin-top:12px;display:inline-block;padding:6px 14px;border-radius:100px;font-size:13px;font-weight:700;background:${data.passed ? 'rgba(52,199,89,0.12)' : 'rgba(255,59,48,0.1)'};color:${passColor};">${data.passed ? 'Passed' : 'Not passed'} · ${grade}</div>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" style="margin-bottom:16px;"><tr>
      <td width="31%" align="center" style="padding:12px 8px;background:${COLORS.bg};border-radius:12px;"><div style="font-size:18px;font-weight:800;">${data.score}%</div><div style="font-size:11px;color:${COLORS.secondary};">Score</div></td>
      <td width="3%"></td>
      <td width="31%" align="center" style="padding:12px 8px;background:${COLORS.bg};border-radius:12px;"><div style="font-size:18px;font-weight:800;">${data.correct}/${data.totalQuestions}</div><div style="font-size:11px;color:${COLORS.secondary};">Correct</div></td>
      <td width="3%"></td>
      <td width="31%" align="center" style="padding:12px 8px;background:${COLORS.bg};border-radius:12px;"><div style="font-size:18px;font-weight:800;">${grade}</div><div style="font-size:11px;color:${COLORS.secondary};">Grade</div></td>
    </tr></table>
    ${paragraphHtml(data.passed ? '<span style="color:#3A3A3C;">Your result has been recorded. Keep up the momentum.</span>' : '<span style="color:#3A3A3C;">Review the material and speak with your tutor if you need support.</span>')}
    ${ctaButton(`${data.loginUrl.replace(/\/$/, '')}/dashboard/student`, 'View full results')}
  `;

  return emailDocument({ preheader: `${data.examTitle} — ${data.score}%`, children: inner });
}

export function templatePaymentReceipt(data: {
  schoolName: string;
  amount: number;
  description: string;
  reference: string;
  paidAt: Date;
  loginUrl: string;
}): string {
  const dateStr = data.paidAt.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
  const inner = `
    ${labelCaps('Receipt')}
    ${titleH1('Payment received')}
    ${paragraph(`Thank you, ${data.schoolName}. Your payment is confirmed.`, { muted: true })}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0FDF4;border-radius:16px;border:1px solid #BBF7D0;margin:12px 0 20px;">
      <tr><td style="padding:18px 20px;">
        <table width="100%">
          <tr><td style="padding:10px 0;border-bottom:1px solid #D1FAE5;"><span style="font-size:13px;color:#166534;">Reference</span><br><span style="font-size:14px;font-weight:600;font-family:ui-monospace,monospace;">${escapeHtml(data.reference)}</span></td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #D1FAE5;"><span style="font-size:13px;color:#166534;">Description</span><br><span style="font-size:15px;font-weight:600;">${escapeHtml(data.description)}</span></td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #D1FAE5;"><span style="font-size:13px;color:#166534;">Date</span><br><span style="font-size:15px;font-weight:600;">${escapeHtml(dateStr)}</span></td></tr>
          <tr><td style="padding:10px 0;"><span style="font-size:13px;color:#166534;">Amount</span><br><span style="font-size:24px;font-weight:800;color:#14532d;">₦${data.amount.toLocaleString()}</span></td></tr>
        </table>
      </td></tr>
    </table>
    ${ctaButton(`${data.loginUrl.replace(/\/$/, '')}/dashboard/admin`, 'Open dashboard')}
  `;

  return emailDocument({ preheader: `₦${data.amount.toLocaleString()} · ${data.reference}`, children: inner });
}

export function templateAssignmentNotice(data: {
  firstName: string;
  assignmentTitle: string;
  className: string;
  dueDate: string;
  description: string;
  loginUrl: string;
}): string {
  const inner = `
    ${labelCaps('Assignment')}
    ${titleH1('Something new to submit')}
    ${paragraph(`Hi ${data.firstName} — your tutor posted an assignment for ${data.className}.`, { muted: true })}
    <div style="margin:16px 0;padding:16px 18px;background:${COLORS.blueSoft};border-radius:14px;border:1px solid rgba(30,127,212,0.2);">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.blue};margin-bottom:6px;">Due</div>
      <div style="font-size:16px;font-weight:700;color:${COLORS.text};">${escapeHtml(data.dueDate)}</div>
    </div>
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${COLORS.text};">${escapeHtml(data.assignmentTitle)}</p>
    ${paragraph(data.description, { muted: true })}
    ${ctaButton(`${data.loginUrl.replace(/\/$/, '')}/dashboard/student`, 'View assignment')}
  `;

  return emailDocument({ preheader: `Due ${data.dueDate} — ${data.assignmentTitle}`, children: inner });
}

export function templateSchoolApproved(data: {
  adminName: string;
  schoolName: string;
  loginUrl: string;
}): string {
  const inner = `
    ${labelCaps('Approved')}
    ${titleH1(`You’re live, ${data.adminName}`)}
    ${paragraphHtml(`<strong style="color:${COLORS.text};">${escapeHtml(data.schoolName)}</strong> is approved on AdharaEdu.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr><td style="padding:14px 0;border-bottom:1px solid ${COLORS.separator};"><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:${COLORS.goldSoft};color:#8B6914;font-weight:800;font-size:12px;">1</span> <span style="margin-left:8px;font-size:15px;color:#3A3A3C;">Complete your school profile in the admin portal.</span></td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid ${COLORS.separator};"><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:${COLORS.goldSoft};color:#8B6914;font-weight:800;font-size:12px;">2</span> <span style="margin-left:8px;font-size:15px;color:#3A3A3C;">Add students — individually or via CSV.</span></td></tr>
      <tr><td style="padding:14px 0;"><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:${COLORS.goldSoft};color:#8B6914;font-weight:800;font-size:12px;">3</span> <span style="margin-left:8px;font-size:15px;color:#3A3A3C;">Your tutor will reach out to schedule the first session.</span></td></tr>
    </table>
    ${ctaButton(`${data.loginUrl.replace(/\/$/, '')}/dashboard/admin`, 'Open admin dashboard')}
  `;

  return emailDocument({ preheader: `${data.schoolName} is approved`, children: inner });
}

export function templateSchoolPendingApproval(data: {
  adminName: string;
  schoolName: string;
  supportEmail?: string;
}): string {
  const inner = `
    ${labelCaps('Submitted')}
    ${titleH1(`Account created, ${escapeHtml(data.adminName)}`)}
    ${paragraphHtml(
      `Your school <strong style="color:${COLORS.text};">${escapeHtml(data.schoolName)}</strong> has been created on AdharaEdu and is awaiting approval.`,
    )}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr><td style="padding:14px 0;border-bottom:1px solid ${COLORS.separator};"><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:${COLORS.blueSoft};color:${COLORS.blue};font-weight:800;font-size:12px;">1</span> <span style="margin-left:8px;font-size:15px;color:#3A3A3C;">We’re reviewing your details for approval.</span></td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid ${COLORS.separator};"><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:${COLORS.blueSoft};color:${COLORS.blue};font-weight:800;font-size:12px;">2</span> <span style="margin-left:8px;font-size:15px;color:#3A3A3C;">You’ll receive an email once approved.</span></td></tr>
      <tr><td style="padding:14px 0;"><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:${COLORS.blueSoft};color:${COLORS.blue};font-weight:800;font-size:12px;">3</span> <span style="margin-left:8px;font-size:15px;color:#3A3A3C;">After approval, you can sign in and complete your school profile (onboarding).</span></td></tr>
    </table>
    ${paragraph(
      data.supportEmail
        ? `Need help? Reply to this email or contact ${data.supportEmail}.`
        : `Need help? Reply to this email and our team will assist.`,
      { small: true, muted: true },
    )}
  `;

  return emailDocument({ preheader: `${data.schoolName} is pending approval`, children: inner });
}

export function templateReportSubmitted(data: {
  tutorName: string;
  schoolName: string;
  weekStart: string;
  weekEnd: string;
  loginUrl: string;
}): string {
  const inner = `
    ${labelCaps('Super admin')}
    ${titleH1('Weekly report submitted')}
    ${paragraphHtml(`<strong>${escapeHtml(data.tutorName)}</strong> submitted a report for <strong>${escapeHtml(data.schoolName)}</strong>.`)}
    <div style="padding:14px 16px;background:${COLORS.bg};border-radius:12px;font-size:15px;color:#3A3A3C;margin:12px 0 20px;">
      ${escapeHtml(data.weekStart)} → ${escapeHtml(data.weekEnd)}
    </div>
    ${ctaButtonGold(`${data.loginUrl.replace(/\/$/, '')}/dashboard/superadmin`, 'Review report')}
  `;

  return emailDocument({ preheader: `Report from ${data.tutorName}`, children: inner });
}

export function templateCertificateReady(data: {
  firstName: string;
  trackName: string;
  averageScore: number;
  serialNumber: string;
  pdfUrl?: string | null;
  studentPortalUrl: string;
}): string {
  const inner = `
    ${labelCaps('Certificate')}
    ${titleH1('You earned it')}
    ${paragraphHtml(`Congratulations, <strong>${escapeHtml(data.firstName)}</strong> — you completed <strong>${escapeHtml(data.trackName)}</strong> with an average of <strong>${data.averageScore}%</strong>.`)}
    <div style="margin:20px 0;padding:18px;background:${COLORS.bg};border-radius:16px;text-align:center;">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.secondary};margin-bottom:6px;">Serial</div>
      <div style="font-size:17px;font-weight:700;font-family:ui-monospace,monospace;letter-spacing:0.06em;color:${COLORS.text};">${escapeHtml(data.serialNumber)}</div>
    </div>
    ${data.pdfUrl ? ctaButton(data.pdfUrl, 'Download certificate') : paragraph('Your certificate is ready — open the portal to view or download when available.', { muted: true })}
    ${ctaButton(data.studentPortalUrl.replace(/\/$/, ''), 'Open student portal')}
  `;

  return emailDocument({ preheader: `${data.trackName} — certificate ready`, children: inner });
}

export function templatePayrollProcessed(data: {
  firstName: string;
  monthLabel: string;
  schoolName: string;
  netAmount: number;
  totalSessions: number;
}): string {
  const inner = `
    ${labelCaps('Payroll')}
    ${titleH1('Payment processed')}
    ${paragraph(`Hi ${data.firstName} — your payroll for ${data.monthLabel} at ${data.schoolName} has been processed.`, { muted: true })}
    <table role="presentation" width="100%" style="margin:20px 0;background:${COLORS.bg};border-radius:16px;">
      <tr><td style="padding:22px 20px;">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.secondary};">Net amount</div>
        <div style="font-size:32px;font-weight:800;letter-spacing:-0.5px;color:#14532d;margin-top:4px;">₦${data.netAmount.toLocaleString()}</div>
        <div style="margin-top:12px;font-size:14px;color:#3A3A3C;"><strong>${data.totalSessions}</strong> sessions</div>
      </td></tr>
    </table>
    ${paragraph('Funds should reflect per your usual payout schedule.', { small: true, muted: true })}
  `;

  return emailDocument({ preheader: `₦${data.netAmount.toLocaleString()} · ${data.monthLabel}`, children: inner });
}

export function templatePaystackConfirmation(data: {
  schoolName: string;
  amount: number;
  description: string;
  reference: string;
}): string {
  const inner = `
    ${labelCaps('Payment')}
    ${titleH1('We received your payment')}
    ${paragraphHtml(`<strong>${escapeHtml(data.schoolName)}</strong> — thank you. Your payment has been confirmed.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};border-radius:16px;margin:16px 0;">
      <tr><td style="padding:18px 20px;">
        <div style="font-size:13px;color:${COLORS.secondary};">Amount</div>
        <div style="font-size:26px;font-weight:800;color:${COLORS.text};">₦${data.amount.toLocaleString()}</div>
        <div style="margin-top:12px;font-size:15px;color:#3A3A3C;">${escapeHtml(data.description)}</div>
        <div style="margin-top:12px;font-size:12px;font-family:ui-monospace,monospace;color:${COLORS.secondary};">Ref · ${escapeHtml(data.reference)}</div>
      </td></tr>
    </table>
  `;

  return emailDocument({ preheader: `₦${data.amount.toLocaleString()} confirmed`, children: inner });
}

/** New tutor account — complete onboarding & KYC before school assignment. */
export function templateTutorWelcome(data: {
  firstName: string;
  email: string;
  loginUrl: string;
  onboardingUrl: string;
  temporaryPassword: string;
}): string {
  const inner = `
    ${labelCaps('Tutor account')}
    ${titleH1(`Welcome, ${data.firstName}`)}
    ${paragraphHtml(
      `Welcome to the <strong>AdharaEdu</strong> tutoring team. Your account has been created. Before you can be deployed to a school, you need to <strong>complete your onboarding profile</strong> and <strong>KYC verification</strong>.`,
    )}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};border-radius:16px;margin:16px 0;">
      <tr><td style="padding:18px 20px;">
        <div style="font-size:13px;color:${COLORS.secondary};">Sign-in email</div>
        <div style="font-size:15px;font-weight:600;color:${COLORS.text};margin-top:4px;">${escapeHtml(data.email)}</div>
        <div style="margin-top:14px;font-size:13px;color:${COLORS.secondary};">Temporary password</div>
        <div style="font-size:15px;font-weight:700;font-family:ui-monospace,monospace;letter-spacing:0.04em;color:${COLORS.text};margin-top:4px;">${escapeHtml(data.temporaryPassword)}</div>
      </td></tr>
    </table>
    <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:${COLORS.text};">Next steps</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
      <tr><td style="padding:10px 0;border-bottom:1px solid ${COLORS.separator};font-size:15px;color:#3A3A3C;">
        <span style="display:inline-block;min-width:22px;font-weight:800;color:${COLORS.blue};">1</span> Sign in and change your password if prompted.
      </td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid ${COLORS.separator};font-size:15px;color:#3A3A3C;">
        <span style="display:inline-block;min-width:22px;font-weight:800;color:${COLORS.blue};">2</span> Open onboarding and fill your profile (bio, tracks, bank details as required).
      </td></tr>
      <tr><td style="padding:10px 0;font-size:15px;color:#3A3A3C;">
        <span style="display:inline-block;min-width:22px;font-weight:800;color:${COLORS.blue};">3</span> Upload KYC: ID, passport-style photo, signature, and guarantors as requested.
      </td></tr>
    </table>
    ${paragraph('Once your onboarding is complete and verified, our team can assign you to a school.', { muted: true })}
    ${ctaButton(data.onboardingUrl.replace(/\/$/, ''), 'Complete onboarding')}
    ${ctaButtonGold(data.loginUrl.replace(/\/$/, ''), 'Sign in')}
    ${paragraph('If you did not expect this email, contact AdharaEdu support.', { small: true, muted: true })}
  `;

  return emailDocument({
    preheader: 'Complete onboarding and KYC before your school assignment',
    children: inner,
  });
}
