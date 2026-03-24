
import { Controller, Get, Post, Param, Body, Query, Request, UseGuards, Headers, RawBodyRequest, Req } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { PaystackService } from "./paystack.service";
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Payments — Paystack")
@Controller("paystack")
export class PaystackController {
  constructor(private svc: PaystackService) {}

  // Initiate payment for an invoice (school admin)
  @Post("initialize/:paymentId")
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @Roles("SCHOOL_ADMIN", "SUPER_ADMIN")
  @ApiBearerAuth()
  initialize(@Param("paymentId") paymentId: string, @Request() req) {
    return this.svc.initializePayment(paymentId, req.user.email || "");
  }

  // Verify after redirect
  @Get("verify")
  verify(@Query("reference") reference: string) {
    return this.svc.verifyPayment(reference);
  }

  // Paystack webhook (no auth — uses HMAC signature)
  @Post("webhook")
  webhook(@Body() body: any, @Headers("x-paystack-signature") sig: string) {
    if (!this.svc.verifyWebhookSignature(JSON.stringify(body), sig)) return { received: false };
    this.svc.handleWebhook(body).catch(() => {});
    return { received: true };
  }
}
