import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NoticesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.notice.findMany({ orderBy: { createdAt: "desc" } });
  }

  create(title: string, body: string, postedBy: string) {
    return this.prisma.notice.create({ data: { title, body, postedBy } });
  }
}
