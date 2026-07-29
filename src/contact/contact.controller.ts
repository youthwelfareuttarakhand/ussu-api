import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import { ContactService } from "./contact.service";
import { CreateContactMessageDto } from "./dto/create-contact-message.dto";

@Controller("contact")
export class ContactController {
  constructor(private contact: ContactService) {}

  @Post()
  @Public()
  @HttpCode(201)
  create(@Body() dto: CreateContactMessageDto) {
    return this.contact.create(dto);
  }
}
