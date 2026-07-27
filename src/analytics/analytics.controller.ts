import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { Role } from "@prisma/client";
import { Public } from "../common/decorators/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { AnalyticsService } from "./analytics.service";
import { RecordVisitDto } from "./dto/record-visit.dto";

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

@Controller("analytics")
@UseGuards(RolesGuard)
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Post("visit")
  @Public()
  @HttpCode(201)
  recordVisit(@Body() dto: RecordVisitDto, @Req() req: Request) {
    return this.analytics.recordVisit(dto.path, clientIp(req));
  }

  @Get("overview")
  @Roles(Role.STAFF, Role.ADMIN)
  overview() {
    return this.analytics.overview();
  }

  @Get("visitors")
  @Roles(Role.STAFF, Role.ADMIN)
  visitors() {
    return this.analytics.visitors();
  }
}
