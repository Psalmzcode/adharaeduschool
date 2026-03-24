
import { Module } from "@nestjs/common";
import { PaystackController } from "./paystack.controller";
import { PaystackService } from "./paystack.service";
import { EmailModule } from "../email/email.module";

@Module({ imports: [EmailModule], controllers: [PaystackController], providers: [PaystackService], exports: [PaystackService] })
export class PaystackModule {}
