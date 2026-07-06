import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.staff.findMany({
      include: { user: { select: { id: true, email: true, role: true } } },
    });
  }
}
