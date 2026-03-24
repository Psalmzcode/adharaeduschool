
import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import * as crypto from "crypto";
import axios from "axios";

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly baseUrl = "https://api.paystack.co";

  constructor(private prisma: PrismaService, private email: EmailService) {}

  private get secretKey() {
    return process.env.PAYSTACK_SECRET_KEY || "";
  }

  private headers() {
    return { Authorization: `Bearer ${this.secretKey}`, "Content-Type": "application/json" };
  }

  // Initialise a payment for a school fee invoice
  async initializePayment(paymentId: string, email: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { school: { select: { name: true } } },
    });
    if (!payment) throw new BadRequestException("Payment not found");
    if (payment.isPaid) throw new BadRequestException("Invoice already paid");

    const amountKobo = Math.round(payment.amount * 100); // Paystack uses kobo

    if (!this.secretKey) {
      // No Paystack key — return demo response
      this.logger.warn("PAYSTACK_SECRET_KEY not set — returning demo payment link");
      return {
        status: true,
        message: "Demo mode — configure PAYSTACK_SECRET_KEY for live payments",
        data: {
          authorization_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/payment/demo?ref=DEMO-${paymentId}`,
          access_code: "DEMO",
          reference: `DEMO-${paymentId}`,
        },
      };
    }

    const response = await axios.post(
      `${this.baseUrl}/transaction/initialize`,
      {
        email,
        amount: amountKobo,
        reference: `ADH-${paymentId}-${Date.now()}`,
        metadata: { paymentId, schoolName: payment.school.name, invoiceDesc: payment.description },
        callback_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/payment/verify`,
      },
      { headers: this.headers() }
    );

    return response.data;
  }

  // Verify payment after redirect
  async verifyPayment(reference: string) {
    if (reference.startsWith("DEMO-")) {
      // Demo mode
      const paymentId = reference.replace("DEMO-", "").split("-")[0];
      return this.markPaymentPaid(paymentId, reference);
    }

    if (!this.secretKey) throw new BadRequestException("Paystack not configured");

    const response = await axios.get(
      `${this.baseUrl}/transaction/verify/${reference}`,
      { headers: this.headers() }
    );

    const { data } = response.data;
    if (data.status !== "success") throw new BadRequestException("Payment not successful");

    const paymentId = data.metadata?.paymentId;
    if (!paymentId) throw new BadRequestException("Payment reference invalid");

    return this.markPaymentPaid(paymentId, reference);
  }

  private async markPaymentPaid(paymentId: string, reference: string) {
    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { isPaid: true, paidAt: new Date(), receiptUrl: reference },
      include: { school: { select: { name: true, admins: { select: { email: true } } } } },
    });

    // Notify school admin
    const adminEmails = payment.school.admins.map((a: any) => a.email);
    if (adminEmails.length) {
      await this.email.send(
        adminEmails,
        `Payment Confirmed: ${payment.description}`,
        `<p>Your payment of <strong>₦${payment.amount.toLocaleString()}</strong> for <strong>${payment.description}</strong> has been confirmed.</p>
         <p>Reference: ${reference}</p><p>AdharaEdu © 2026</p>`
      );
    }

    // Notify super admin
    await this.prisma.notification.create({
      data: {
        userId: "SUPER_ADMIN_BROADCAST",
        title: "Payment Received",
        message: `${payment.school.name} paid ₦${payment.amount.toLocaleString()} — ${payment.description}`,
      },
    }).catch(() => {});

    return payment;
  }

  // Paystack webhook — raw body verification
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.secretKey) return true; // Skip in dev
    const hash = crypto.createHmac("sha512", this.secretKey).update(rawBody).digest("hex");
    return hash === signature;
  }

  async handleWebhook(event: any) {
    if (event.event === "charge.success") {
      const ref = event.data?.reference;
      if (ref) await this.verifyPayment(ref).catch(e => this.logger.error("Webhook verify failed:", e));
    }
  }
}
