import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

@Injectable()
export class RollNumberService {
  // Same transaction-safety approach as UkssuService.nextId /
  // RegistrationNumberService.nextNumber: must run inside the caller's
  // transaction, atomic UPDATE increments the per-(year, courseCode)
  // counter, falls back to CREATE on the first assignment for that pair,
  // retries the UPDATE if it lost the create race.
  async nextRollNumber(tx: Prisma.TransactionClient, courseCode: string): Promise<string> {
    const year = new Date().getFullYear();
    const yy = String(year).slice(-2);

    let value: number;
    try {
      const row = await tx.rollNumberCounter.update({
        where: { year_courseCode: { year, courseCode } },
        data: { value: { increment: 1 } },
      });
      value = row.value;
    } catch {
      try {
        const row = await tx.rollNumberCounter.create({ data: { year, courseCode, value: 1 } });
        value = row.value;
      } catch {
        const row = await tx.rollNumberCounter.update({
          where: { year_courseCode: { year, courseCode } },
          data: { value: { increment: 1 } },
        });
        value = row.value;
      }
    }

    return `${yy}${courseCode}${String(value).padStart(6, "0")}`;
  }
}
