import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AcademicAuditAction, ModuleStackVariant, ModuleType, TrackLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AcademicAuditService, AuditActor } from '../academic-audit/academic-audit.service';
import { modulesWhereForTrack } from '../common/module-curriculum';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { certificateArtForTrack, certificateGrade, formatCertDate } from './certificate-track-art';
import { generateCertificatePdf } from './certificate-pdf.generator';

@Injectable()
export class CertificatesService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private config: ConfigService,
    private audit: AcademicAuditService,
  ) {}

  private static readonly COMPLETION_EXAM_PASS = 50;

  private async trackCompletionExamModule(track: TrackLevel) {
    return this.prisma.module.findFirst({
      where: {
        track,
        moduleType: ModuleType.TRACK_COMPLETION_EXAM,
        stackVariant: ModuleStackVariant.COMMON,
      },
      select: { id: true, title: true },
    });
  }

  private async bestTrackCompletionExamScore(studentId: string, completionModuleId: string): Promise<number | null> {
    const attempt = await this.prisma.examAttempt.findFirst({
      where: {
        studentId,
        status: 'COMPLETED',
        score: { not: null },
        cbtExam: { moduleId: completionModuleId },
      },
      orderBy: [{ score: 'desc' }, { submittedAt: 'desc' }],
      select: { score: true },
    });
    if (attempt?.score == null) return null;
    const score = Number(attempt.score);
    return Number.isNaN(score) ? null : score;
  }

  // Check if a student qualifies for a certificate
  async checkEligibility(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { track: true, track3Stack: true },
    });
    if (!student) return { eligible: false, reason: 'Student not found' };

    const progress = await this.prisma.moduleProgress.findMany({
      where: { studentId },
      include: { module: true },
    });
    if (progress.length === 0) return { eligible: false, reason: 'No modules found' };

    const trackGroups: Record<string, typeof progress> = {};
    for (const p of progress) {
      const t = p.module.track;
      if (!trackGroups[t]) trackGroups[t] = [];
      trackGroups[t].push(p);
    }

    const eligible: string[] = [];
    const blockers: Record<string, string> = {};
    const passMark = CertificatesService.COMPLETION_EXAM_PASS;

    for (const [track, mods] of Object.entries(trackGroups)) {
      const trackLevel = track as TrackLevel;
      const expected = await this.prisma.module.findMany({
        where: {
          ...modulesWhereForTrack(trackLevel, student.track3Stack),
          moduleType: ModuleType.STANDARD,
        },
        select: { id: true },
      });
      const expectedIds = new Set(expected.map((m) => m.id));
      const inTrack = mods.filter((p) => expectedIds.has(p.moduleId));
      const completed = inTrack.filter((m) => m.status === 'COMPLETED');
      const scores = completed.map((m) => m.score || 0);
      const avg = scores.length ? scores.reduce((a, b) => a + b) / scores.length : 0;

      if (expected.length === 0) {
        blockers[track] = 'No standard modules defined for this track';
        continue;
      }
      if (completed.length !== expected.length) {
        blockers[track] = `Standard modules incomplete (${completed.length}/${expected.length})`;
        continue;
      }
      if (avg < passMark) {
        blockers[track] = `Module average below ${passMark}% (${Math.round(avg)}%)`;
        continue;
      }

      const completionMod = await this.trackCompletionExamModule(trackLevel);
      if (!completionMod) {
        blockers[track] = 'Track completion exam not configured for this track';
        continue;
      }
      const completionScore = await this.bestTrackCompletionExamScore(studentId, completionMod.id);
      if (completionScore == null || completionScore < passMark) {
        const shown = completionScore == null ? 'not attempted' : `${completionScore}%`;
        blockers[track] = `Track completion exam required (≥${passMark}%) — current: ${shown}`;
        continue;
      }

      eligible.push(track);
    }
    return { eligible: eligible.length > 0, tracks: eligible, blockers };
  }

  // Issue certificate for a track
  async issueCertificate(studentId: string, track: string, actor?: AuditActor) {
    // Check not already issued
    const existing = await this.prisma.certificate.findFirst({
      where: { studentId, track, isRevoked: false },
    });
    if (existing) return existing;

    // Verify eligibility
    const eligibility = await this.checkEligibility(studentId);
    if (!eligibility.tracks?.includes(track)) {
      throw new BadRequestException(
        eligibility.blockers?.[track] ||
          'Student has not met certificate requirements for this track',
      );
    }

    // Get student details
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        school: true,
        moduleProgress: { where: { status: 'COMPLETED', module: { track: track as any } }, include: { module: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const scores = student.moduleProgress.map(p => p.score || 0);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const serialNumber = `ADH-CERT-${new Date().getFullYear()}-${uuidv4().split('-')[0].toUpperCase()}`;
    const art = certificateArtForTrack(track);
    const trackName = art.trackLabel;
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');

    const verifyUrl = `${frontendUrl}/verify-certificate/${serialNumber}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 150, margin: 1 });

    const pdfBytes = await generateCertificatePdf({
      studentName: `${student.user.firstName} ${student.user.lastName}`,
      regNumber: student.regNumber,
      schoolName: student.school.name,
      trackLabel: trackName,
      averageScore: avg,
      serialNumber,
      issueDate: new Date(),
      qrDataUrl,
      verifyUrl,
      art,
    });

    // Upload to Cloudinary
    let pdfUrl = '';
    try {
      const cloudinary = require('cloudinary').v2;
      cloudinary.config({
        cloud_name: this.config.get('CLOUDINARY_CLOUD_NAME'),
        api_key: this.config.get('CLOUDINARY_API_KEY'),
        api_secret: this.config.get('CLOUDINARY_API_SECRET'),
      });
      const uploadResult = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'adharaedu/certificates', public_id: serialNumber, resource_type: 'raw', format: 'pdf' },
          (err: any, result: any) => err ? reject(err) : resolve(result),
        );
        stream.end(pdfBytes);
      });
      pdfUrl = uploadResult.secure_url;
    } catch (e) {
      // Cloudinary upload failed — continue without URL
    }

    // Save certificate record
    const cert = await this.prisma.certificate.create({
      data: { studentId, track, serialNumber, pdfUrl, qrCode: qrDataUrl, averageScore: avg },
    });

    if (student.user.email) {
      await this.emailService.sendCertificateReady({
        email: student.user.email,
        firstName: student.user.firstName,
        trackName,
        averageScore: avg,
        serialNumber,
        pdfUrl: pdfUrl || null,
        studentPortalUrl: `${frontendUrl}/dashboard/student`,
      });
    }

    if (actor) {
      await this.audit.log({
        schoolId: student.schoolId,
        actor,
        action: AcademicAuditAction.CERT_ISSUE,
        className: student.className,
        studentId,
        summary: `Issued ${track.replace('TRACK_', 'Track ')} certificate for ${student.user.firstName} ${student.user.lastName} (${serialNumber})`,
        metadata: { track, serialNumber, averageScore: avg },
      });
    }

    return { ...cert, pdfBytes: pdfUrl ? undefined : pdfBytes.toString('base64') };
  }

  async bulkIssueEligible(
    schoolId: string,
    actor: AuditActor,
    opts?: { className?: string; track?: string },
  ) {
    const where: { schoolId: string; className?: string; track?: TrackLevel } = { schoolId };
    const cn = opts?.className?.trim();
    const tr = opts?.track?.trim().toUpperCase();
    if (cn) where.className = cn;
    if (tr && Object.values(TrackLevel).includes(tr as TrackLevel)) {
      where.track = tr as TrackLevel;
    }

    const students = await this.prisma.student.findMany({
      where,
      select: {
        id: true,
        track: true,
        className: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    const issued: any[] = [];
    const skipped: Array<{ studentId: string; name: string; reason: string }> = [];
    const failed: Array<{ studentId: string; name: string; error: string }> = [];

    for (const s of students) {
      const name = `${s.user?.firstName || ''} ${s.user?.lastName || ''}`.trim() || s.id;
      const track = (where.track || s.track) as string;
      try {
        const elig = await this.checkEligibility(s.id);
        if (!elig.tracks?.includes(track)) {
          skipped.push({ studentId: s.id, name, reason: 'Not eligible for track' });
          continue;
        }
        const existing = await this.prisma.certificate.findFirst({
          where: { studentId: s.id, track, isRevoked: false },
        });
        if (existing) {
          skipped.push({ studentId: s.id, name, reason: 'Already issued' });
          continue;
        }
        const cert = await this.issueCertificate(s.id, track, actor);
        issued.push(cert);
      } catch (e: any) {
        failed.push({ studentId: s.id, name, error: e?.message || 'Issue failed' });
      }
    }

    if (issued.length) {
      await this.audit.log({
        schoolId,
        actor,
        action: AcademicAuditAction.BULK_CERT_ISSUE,
        className: cn || undefined,
        summary: `Bulk issued ${issued.length} certificate(s)${cn ? ` for ${cn}` : ''}`,
        metadata: { issued: issued.length, skipped: skipped.length, failed: failed.length, track: tr || null },
      });
    }

    return { issued: issued.length, skipped, failed, certificates: issued };
  }

  async findByStudent(studentId: string) {
    return this.prisma.certificate.findMany({
      where: { studentId, isRevoked: false },
      orderBy: { issueDate: 'desc' },
    });
  }

  async findAll(schoolId?: string) {
    return this.prisma.certificate.findMany({
      where: schoolId ? { student: { schoolId } } : undefined,
      include: {
        student: {
          select: {
            id: true,
            regNumber: true,
            schoolId: true,
            user: { select: { firstName: true, lastName: true } },
            school: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { issueDate: 'desc' },
    });
  }

  async revoke(id: string, actor: { role: string; userId: string }) {
    const cert = await this.prisma.certificate.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            school: { include: { admins: { select: { id: true } } } },
          },
        },
      },
    });
    if (!cert) throw new NotFoundException('Certificate not found');
    if (cert.isRevoked) return cert;

    const updated = await this.prisma.certificate.update({
      where: { id },
      data: { isRevoked: true, expiryDate: new Date() },
      include: {
        student: {
          select: {
            id: true,
            regNumber: true,
            schoolId: true,
            className: true,
            user: { select: { firstName: true, lastName: true } },
            school: { select: { id: true, name: true } },
          },
        },
      },
    });

    await this.audit.log({
      schoolId: updated.student.schoolId,
      actor: { userId: actor.userId, role: actor.role },
      action: AcademicAuditAction.CERT_REVOKE,
      className: updated.student.className,
      studentId: updated.studentId,
      summary: `Revoked certificate ${updated.serialNumber} for ${updated.student.user.firstName} ${updated.student.user.lastName}`,
      metadata: { serialNumber: updated.serialNumber, track: updated.track },
    });

    return updated;
  }

  async verify(serialNumber: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { serialNumber },
      include: { student: { include: { user: { select: { firstName: true, lastName: true } }, school: { select: { name: true } } } } },
    });
    if (!cert) return { valid: false, message: 'Certificate not found' };
    if (cert.isRevoked) return { valid: false, message: 'Certificate has been revoked' };
    return {
      valid: true,
      certificate: {
        serialNumber: cert.serialNumber,
        studentName: `${cert.student.user.firstName} ${cert.student.user.lastName}`,
        school: cert.student.school.name,
        track: certificateArtForTrack(cert.track).trackLabel,
        averageScore: cert.averageScore,
        issueDate: cert.issueDate,
        template: certificateArtForTrack(cert.track).template,
        pdfUrl: cert.pdfUrl || null,
      },
    };
  }

  async previewIssue(studentId: string, track: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        school: { select: { id: true, name: true } },
        moduleProgress: {
          where: { status: 'COMPLETED', module: { track: track as TrackLevel, moduleType: ModuleType.STANDARD } },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const eligibility = await this.checkEligibility(studentId);
    const art = certificateArtForTrack(track);
    const scores = student.moduleProgress.map((p) => p.score || 0);
    const avg = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    const completionMod = await this.trackCompletionExamModule(track as TrackLevel);
    const completionExamScore = completionMod
      ? await this.bestTrackCompletionExamScore(studentId, completionMod.id)
      : null;
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    const sampleSerial = `ADH-CERT-${new Date().getFullYear()}-PREVIEW`;
    const issueDate = new Date();
    const isEligible = eligibility.tracks?.includes(track) ?? false;

    return {
      studentId,
      studentName: `${student.user.firstName} ${student.user.lastName}`,
      regNumber: student.regNumber,
      schoolId: student.school.id,
      schoolName: student.school.name,
      track,
      trackLabel: art.trackLabel,
      template: art.template,
      accent: art.accent,
      navy: art.navy,
      gold: art.gold,
      averageScore: avg,
      grade: certificateGrade(avg),
      issueDate: issueDate.toISOString(),
      issueDateLabel: formatCertDate(issueDate),
      serialNumber: sampleSerial,
      verifyUrl: `${frontendUrl}/verify-certificate/${sampleSerial}`,
      completionExamTitle: completionMod?.title ?? null,
      completionExamScore,
      completionExamPassMark: CertificatesService.COMPLETION_EXAM_PASS,
      eligible: isEligible,
      eligibilityReason: isEligible ? null : (eligibility.blockers?.[track] ?? 'Certificate requirements not met'),
    };
  }

  async listEligible(opts?: { schoolId?: string; className?: string; track?: string }) {
    const where: { schoolId?: string; className?: string; track?: TrackLevel } = {};
    if (opts?.schoolId) where.schoolId = opts.schoolId;
    if (opts?.className?.trim()) where.className = opts.className.trim();
    const tr = opts?.track?.trim().toUpperCase();
    if (tr && Object.values(TrackLevel).includes(tr as TrackLevel)) {
      where.track = tr as TrackLevel;
    }

    const students = await this.prisma.student.findMany({
      where,
      select: {
        id: true,
        regNumber: true,
        track: true,
        className: true,
        schoolId: true,
        user: { select: { firstName: true, lastName: true } },
        school: { select: { id: true, name: true } },
        certificates: { where: { isRevoked: false }, select: { track: true } },
      },
      orderBy: [{ school: { name: 'asc' } }, { className: 'asc' }],
    });

    const rows: any[] = [];
    for (const s of students) {
      const elig = await this.checkEligibility(s.id);
      const issuedTracks = new Set(s.certificates.map((c) => c.track));
      for (const t of elig.tracks || []) {
        if (where.track && t !== where.track) continue;
        if (issuedTracks.has(t as TrackLevel)) continue;
        const preview = await this.previewIssue(s.id, t);
        rows.push({
          studentId: s.id,
          studentName: preview.studentName,
          regNumber: s.regNumber,
          className: s.className,
          schoolId: s.schoolId,
          schoolName: s.school.name,
          track: t,
          trackLabel: preview.trackLabel,
          template: preview.template,
          averageScore: preview.averageScore,
          grade: preview.grade,
        });
      }
    }
    return rows;
  }

  listTrackDesigns() {
    return (['TRACK_1', 'TRACK_2', 'TRACK_3'] as const).map((track) => {
      const art = certificateArtForTrack(track);
      return { track, ...art };
    });
  }
}
