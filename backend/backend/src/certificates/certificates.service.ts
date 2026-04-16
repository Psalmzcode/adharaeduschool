import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TrackLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { modulesWhereForTrack } from '../common/module-curriculum';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { v4 as uuidv4 } from 'uuid';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || pdfFonts;

@Injectable()
export class CertificatesService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private config: ConfigService,
  ) {}

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
    for (const [track, mods] of Object.entries(trackGroups)) {
      const expected = await this.prisma.module.findMany({
        where: modulesWhereForTrack(track as TrackLevel, student.track3Stack),
        select: { id: true },
      });
      const expectedIds = new Set(expected.map((m) => m.id));
      const inTrack = mods.filter((p) => expectedIds.has(p.moduleId));
      const completed = inTrack.filter((m) => m.status === 'COMPLETED');
      const scores = completed.map((m) => m.score || 0);
      const avg = scores.length ? scores.reduce((a, b) => a + b) / scores.length : 0;
      if (completed.length === expected.length && expected.length > 0 && avg >= 50) {
        eligible.push(track);
      }
    }
    return { eligible: eligible.length > 0, tracks: eligible };
  }

  // Issue certificate for a track
  async issueCertificate(studentId: string, track: string) {
    // Check not already issued
    const existing = await this.prisma.certificate.findFirst({
      where: { studentId, track, isRevoked: false },
    });
    if (existing) return existing;

    // Verify eligibility
    const eligibility = await this.checkEligibility(studentId);
    if (!eligibility.tracks?.includes(track)) {
      throw new BadRequestException('Student has not completed all modules for this track');
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
    const trackName = track.replace('TRACK_', 'Track ');
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');

    // Generate QR code
    const verifyUrl = `${frontendUrl}/verify-certificate/${serialNumber}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 150, margin: 1 });

    // Generate PDF
    const pdfBytes = await this.generatePDF({
      studentName: `${student.user.firstName} ${student.user.lastName}`,
      regNumber: student.regNumber,
      schoolName: student.school.name,
      track: trackName,
      averageScore: avg,
      serialNumber,
      issueDate: new Date(),
      qrDataUrl,
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

    return { ...cert, pdfBytes: pdfUrl ? undefined : pdfBytes.toString('base64') };
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

    if (actor.role === 'SCHOOL_ADMIN') {
      const canManage = cert.student.school.admins.some((a) => a.id === actor.userId);
      if (!canManage) throw new ForbiddenException('You can only revoke certificates from your school');
    }

    return this.prisma.certificate.update({
      where: { id },
      data: { isRevoked: true, expiryDate: new Date() },
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
    });
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
        track: cert.track.replace('TRACK_', 'Track '),
        averageScore: cert.averageScore,
        issueDate: cert.issueDate,
        /** Public URL of the generated PDF (e.g. Cloudinary); null if upload failed or not yet generated */
        pdfUrl: cert.pdfUrl || null,
      },
    };
  }

  private async generatePDF(data: {
    studentName: string; regNumber: string; schoolName: string;
    track: string; averageScore: number; serialNumber: string;
    issueDate: Date; qrDataUrl: string;
  }): Promise<Buffer> {
    const grade = data.averageScore >= 90 ? 'Distinction' : data.averageScore >= 70 ? 'Merit' : 'Pass';
    const gold = '#C9A227';
    const goldSoft = '#E8D5A3';
    const ink = '#030910';
    const cream = '#F5F0E6';

    const docDefinition: any = {
      pageOrientation: 'landscape',
      pageSize: 'A4',
      pageMargins: [48, 44, 48, 44],
      defaultStyle: { font: 'Helvetica' },
      background: [
        {
          canvas: [
            { type: 'rect', x: 0, y: 0, w: 841, h: 595, color: ink },
            { type: 'rect', x: 0, y: 0, w: 841, h: 140, color: '#071525' },
            { type: 'line', x1: 0, y1: 140, x2: 841, y2: 140, lineWidth: 1.5, lineColor: gold },
            { type: 'line', x1: 0, y1: 143, x2: 841, y2: 143, lineWidth: 0.35, lineColor: 'rgba(201,162,39,0.35)' },
            { type: 'rect', x: 28, y: 28, w: 785, h: 539, lineColor: 'rgba(201,162,39,0.5)', lineWidth: 1.2 },
            { type: 'rect', x: 34, y: 34, w: 773, h: 527, lineColor: 'rgba(201,162,39,0.15)', lineWidth: 0.6 },
            { type: 'line', x1: 120, y1: 520, x2: 721, y2: 520, lineWidth: 0.4, lineColor: 'rgba(201,162,39,0.2)' },
          ],
        },
      ],
      content: [
        {
          text: 'OFFICIAL CREDENTIAL',
          style: 'eyebrow',
          margin: [0, 8, 0, 6],
        },
        {
          text: 'ADHARAEDU',
          style: 'brand',
          margin: [0, 0, 0, 2],
        },
        {
          text: 'Learn Smart · Grow Together',
          style: 'tagline',
          margin: [0, 0, 0, 18],
        },
        {
          canvas: [{ type: 'line', x1: 280, y1: 0, x2: 560, y2: 0, lineWidth: 0.75, lineColor: gold }],
          margin: [0, 0, 0, 14],
        },
        {
          text: 'Certificate of Completion',
          style: 'title',
          margin: [0, 0, 0, 22],
        },
        {
          text: 'This is to certify that',
          style: 'subtitle',
          margin: [0, 0, 0, 10],
        },
        {
          text: data.studentName,
          style: 'studentName',
          margin: [0, 0, 0, 6],
        },
        {
          canvas: [{ type: 'line', x1: 200, y1: 0, x2: 640, y2: 0, lineWidth: 0.5, lineColor: 'rgba(201,162,39,0.45)' }],
          margin: [0, 4, 0, 8],
        },
        {
          text: `Reg. ${data.regNumber}`,
          style: 'regNo',
          margin: [0, 0, 0, 18],
        },
        {
          text: 'has successfully completed the',
          style: 'body',
          margin: [0, 0, 0, 6],
        },
        {
          text: data.track,
          style: 'track',
          margin: [0, 0, 0, 6],
        },
        {
          text: `programme at ${data.schoolName}`,
          style: 'body',
          margin: [0, 0, 0, 20],
        },
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  fillColor: '#0c1829',
                  stack: [
                    {
                      text: `${data.averageScore}%`,
                      fontSize: 22,
                      bold: true,
                      color: goldSoft,
                      alignment: 'center',
                      margin: [0, 12, 0, 2],
                    },
                    {
                      text: `Average score  ·  ${grade}`,
                      fontSize: 10,
                      color: 'rgba(245,240,230,0.65)',
                      alignment: 'center',
                      margin: [0, 0, 0, 12],
                    },
                  ],
                },
              ],
            ],
          },
          layout: 'noBorders',
          margin: [120, 0, 120, 22],
        },
        {
          columns: [
            {
              width: 100,
              stack: [
                { text: 'VERIFY', fontSize: 7, color: 'rgba(245,240,230,0.35)', letterSpacing: 1.2, margin: [0, 0, 0, 4] },
                { image: data.qrDataUrl, width: 82, height: 82 },
              ],
            },
            {
              width: '*',
              stack: [
                {
                  canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.8, lineColor: gold }],
                  margin: [0, 52, 0, 6],
                },
                { text: 'Ali Samuel Chidera', style: 'signName' },
                { text: 'Founder & Chief Learning Officer', style: 'signTitle' },
                { text: 'AdharaEdu', style: 'signOrg' },
              ],
              margin: [28, 0, 0, 0],
            },
            {
              width: 200,
              stack: [
                {
                  text: data.issueDate.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }),
                  style: 'metadata',
                  alignment: 'right',
                },
                { text: data.serialNumber, style: 'serial', alignment: 'right', margin: [0, 6, 0, 0] },
                {
                  text: 'Scan QR to verify authenticity',
                  fontSize: 7,
                  color: 'rgba(245,240,230,0.35)',
                  alignment: 'right',
                  margin: [0, 10, 0, 0],
                },
              ],
            },
          ],
          columnGap: 12,
        },
      ],
      styles: {
        eyebrow: {
          fontSize: 8,
          letterSpacing: 3.2,
          color: 'rgba(232,213,163,0.55)',
          alignment: 'center',
          bold: true,
        },
        brand: {
          fontSize: 32,
          bold: true,
          color: gold,
          alignment: 'center',
        },
        tagline: {
          fontSize: 9,
          color: 'rgba(245,240,230,0.45)',
          alignment: 'center',
          italics: true,
        },
        title: {
          fontSize: 22,
          bold: true,
          color: cream,
          alignment: 'center',
        },
        subtitle: {
          fontSize: 11,
          color: 'rgba(245,240,230,0.55)',
          alignment: 'center',
        },
        studentName: {
          fontSize: 28,
          bold: true,
          color: '#FFFFFF',
          alignment: 'center',
        },
        regNo: {
          fontSize: 10,
          color: 'rgba(245,240,230,0.45)',
          alignment: 'center',
        },
        body: {
          fontSize: 12,
          color: 'rgba(245,240,230,0.72)',
          alignment: 'center',
        },
        track: {
          fontSize: 17,
          bold: true,
          color: goldSoft,
          alignment: 'center',
        },
        signName: { fontSize: 11, bold: true, color: cream, margin: [0, 0, 0, 2] },
        signTitle: { fontSize: 8, color: 'rgba(245,240,230,0.45)' },
        signOrg: { fontSize: 8, color: 'rgba(201,162,39,0.75)', margin: [0, 4, 0, 0] },
        metadata: { fontSize: 8, color: 'rgba(245,240,230,0.4)' },
        serial: { fontSize: 9, color: goldSoft, font: 'Courier', bold: true },
      },
    };

    return new Promise<Buffer>((resolve, reject) => {
      const doc = (pdfMake as any).createPdf(docDefinition);
      doc.getBuffer((buf: Buffer) => resolve(buf), reject);
    });
  }
}
