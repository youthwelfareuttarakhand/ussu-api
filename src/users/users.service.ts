import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  // Login accepts either an email or a 10-digit phone number as the
  // identifier — looks up by whichever shape the input matches.
  findByEmailOrPhone(identifier: string) {
    const isPhone = /^[0-9]{10}$/.test(identifier);
    return this.prisma.user.findUnique({ where: isPhone ? { phone: identifier } : { email: identifier } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  updatePasswordHash(id: string, passwordHash: string) {
    return this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }
}
