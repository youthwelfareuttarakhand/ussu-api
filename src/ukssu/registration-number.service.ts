import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

@Injectable()
export class RegistrationNumberService {
  // Same transaction-safety approach as UkssuService.nextId: must run inside
  // the caller's transaction, atomic UPDATE increments the per-year counter,
  // falls back to CREATE on first-ever signup for the year, retries the
  // UPDATE if it lost the create race.
  async nextNumber(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getFullYear();

    let value: number;
    try {
      const row = await tx.registrationNumberCounter.update({
        where: { year },
        data: { value: { increment: 1 } },
      });
      value = row.value;
    } catch {
      try {
        const row = await tx.registrationNumberCounter.create({ data: { year, value: 1 } });
        value = row.value;
      } catch {
        const row = await tx.registrationNumberCounter.update({
          where: { year },
          data: { value: { increment: 1 } },
        });
        value = row.value;
      }
    }

    return `REG-${year}-${String(value).padStart(6, "0")}`;
  }
}
