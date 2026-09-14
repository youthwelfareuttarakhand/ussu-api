// One-off: sends the "admission confirmed" email to specific already-approved
// students (ukssuId already issued) whose approval happened before the
// auto-send-on-approve wiring landed (AdmissionsService.updateStatus).
//
// Plain HTML send (mirrors MailService.sendAdmissionApproved) — no Resend
// dashboard template dependency.
//
// Run with:
//   DATABASE_URL=... npx ts-node prisma/notify-admission-approved.ts UKSSU-2026-STU-000093 ...   # dry run
//   DATABASE_URL=... npx ts-node prisma/notify-admission-approved.ts --send UKSSU-2026-STU-000093 ...
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";

const prisma = new PrismaClient();

const FROM = "USSU Admissions <admissions@ukssu.ac.in>";
const SUBJECT = "Admission Confirmed — Uttarakhand State Sports University";

const args = process.argv.slice(2);
const SEND = args.includes("--send");
const ukssuIds = args.filter((a) => a.startsWith("UKSSU-"));

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function html(fullName: string, ukssuId: string, programme: string | null) {
  return `
    <p>Dear ${escapeHtml(fullName)},</p>
    <p>Congratulations! Your admission to <strong>${escapeHtml(programme ?? "Uttarakhand State Sports University")}</strong> at Uttarakhand State Sports University has been confirmed.</p>
    <p><strong>Your UKSSU ID:</strong> ${escapeHtml(ukssuId)}</p>
    <p>You can now log in to the student portal using this ID to view your fee details and complete any remaining payments.</p>
    <p>Regards,<br />Uttarakhand State Sports University</p>
  `;
}

async function main() {
  if (ukssuIds.length === 0) {
    console.error("Pass one or more UKSSU IDs as arguments.");
    process.exit(1);
  }

  const users = await prisma.user.findMany({
    where: { ukssuId: { in: ukssuIds } },
    include: { student: true },
  });

  const found = new Set(users.map((u) => u.ukssuId));
  const missing = ukssuIds.filter((id) => !found.has(id));
  if (missing.length) console.log(`NOT FOUND: ${missing.join(", ")}`);

  console.log(`\n${SEND ? "SEND" : "DRY RUN"}  ·  from ${FROM}\n`);
  for (const u of users) {
    console.log(`  ${u.email.padEnd(38)} ${u.ukssuId!.padEnd(24)} ${u.fullName.padEnd(28)} ${u.student?.programme ?? "—"}`);
  }

  if (!SEND) {
    console.log("\nNothing sent. Re-run with --send to send.\n");
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY not set — cannot send.");
    process.exit(1);
  }
  const resend = new Resend(apiKey);

  for (const u of users) {
    const result = await resend.emails.send({
      from: FROM,
      to: u.email,
      subject: SUBJECT,
      html: html(u.fullName, u.ukssuId!, u.student?.programme ?? null),
    });
    if (result.error) {
      console.log(`  FAIL   ${u.email}  ${result.error.name}: ${result.error.message}`);
    } else {
      console.log(`  sent   ${u.email}  (${result.data?.id})`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
