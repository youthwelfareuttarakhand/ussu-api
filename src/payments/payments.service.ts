import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import Razorpay from "razorpay";

// A malformed/short signature from a client is expected untrusted input, not
// a bug — timingSafeEqual throws on mismatched buffer lengths, so the length
// check must come first rather than letting it throw.
function timingSafeEqualHex(expectedHex: string, actualHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

@Injectable()
export class PaymentsService {
  private readonly client: Razorpay;

  constructor(private config: ConfigService) {
    this.client = new Razorpay({
      key_id: this.config.get<string>("razorpay.keyId")!,
      key_secret: this.config.get<string>("razorpay.keySecret")!,
    });
  }

  async createOrder(amountPaise: number, receipt: string) {
    const order = await this.client.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
    });
    return { id: order.id, amount: order.amount };
  }

  // Verifies the signature Razorpay Checkout hands back to the client on
  // success. Never trust this alone for anything final — it's for instant UX;
  // the webhook (verifyWebhookSignature) is the authoritative confirmation.
  verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
    const expected = crypto
      .createHmac("sha256", this.config.get<string>("razorpay.keySecret")!)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    return timingSafeEqualHex(expected, signature);
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const expected = crypto
      .createHmac("sha256", this.config.get<string>("razorpay.webhookSecret")!)
      .update(rawBody)
      .digest("hex");
    return timingSafeEqualHex(expected, signature);
  }
}
