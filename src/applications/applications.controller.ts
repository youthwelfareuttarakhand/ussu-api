import { Body, Controller, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../common/decorators/public.decorator";
import { ApplicationsService } from "./applications.service";
import { CreateApplicationDto } from "./dto/create-application.dto";

@Controller("applications")
export class ApplicationsController {
  constructor(private applications: ApplicationsService) {}

  @Post()
  @Public()
  create(@Body() dto: CreateApplicationDto, @Res({ passthrough: true }) res: Response) {
    return this.applications.create(dto, res);
  }
}
