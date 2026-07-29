import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { CreateContactMessageDto } from "./dto/create-contact-message.dto";

@Injectable()
export class ContactService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async create(dto: CreateContactMessageDto) {
    await this.prisma.contactMessage.create({ data: dto });

    // Fire-and-forget: the submission is already saved above, so a mail
    // failure must never fail the request — mirrors MailService's own
    // error-swallowing pattern for payment confirmations.
    void this.mail.sendContactNotification(dto);

    return { success: true as const };
  }
}
