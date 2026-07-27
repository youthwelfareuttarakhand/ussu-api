import { Injectable } from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";

const ROLE_CODES: Record<Role, string> = {
  STUDENT: "STU",
  STAFF: "STF",
  ADMIN: "ADM",
};

@Injectable()
export class UkssuService {
  // Must run inside the same transaction as the User row it's assigned to,
  // so the counter increment and the account creation succeed or fail
  // together. Postgres row-locks the counter row on UPDATE, so concurrent
  // signups in the same (year, roleCode) never get the same sequence number.
  async nextId(tx: Prisma.TransactionClient, role: Role): Promise<string> {
    const year = new Date().getFullYear();
    const roleCode = ROLE_CODES[role];

    let value: number;
    try {
      const row = await tx.ukssuIdCounter.update({
        where: { year_roleCode: { year, roleCode } },
        data: { value: { increment: 1 } },
      });
      value = row.value;
    } catch {
      // First-ever signup for this (year, roleCode) pair — no row yet.
      try {
        const row = await tx.ukssuIdCounter.create({ data: { year, roleCode, value: 1 } });
        value = row.value;
      } catch {
        // Lost the race to create the first row — someone else beat us to it.
        const row = await tx.ukssuIdCounter.update({
          where: { year_roleCode: { year, roleCode } },
          data: { value: { increment: 1 } },
        });
        value = row.value;
      }
    }

    return `UKSSU-${year}-${roleCode}-${String(value).padStart(6, "0")}`;
  }
}
