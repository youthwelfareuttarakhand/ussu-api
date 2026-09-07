// One-off: emails every admitted student (User.ukssuId set) who still owes
// their first-cycle course fee, telling them their admission is confirmed and
// to pay the semester/annual fee on the portal by the deadline.
//
// Uses the Resend dashboard template "fee-payment-selected" (source of truth:
// emails/fee-payment-selected.html — must be uploaded AND published first).
//
// Run with:
//   npx ts-node prisma/notify-selected-fee-payment.ts               # dry run (prints table, sends nothing)
//   npx ts-node prisma/notify-selected-fee-payment.ts --self-check  # offline assertions on the eligibility logic
//   npx ts-node prisma/notify-selected-fee-payment.ts --send        # actually send
//   npx ts-node prisma/notify-selected-fee-payment.ts --send --test-to=me@x.com --limit=1   # real-send smoke test
//   npx ts-node prisma/notify-selected-fee-payment.ts --send --force # ignore the already-sent log
//
// ponytail: raw Resend client + duplicated FROM string / template contract,
// matching every other prisma/ script (none boot Nest). If this becomes a
// recurring staff action, promote it to MailService.sendFeePaymentNotice()
// plus a POST /students/notify-fee endpoint and drop this script.
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { PrismaClient, type FeeCadence } from "@prisma/client";
import { Resend } from "resend";

const prisma = new PrismaClient();

const FROM = "USSU Admissions <admissions@ukssu.ac.in>"; // ponytail: mirrors config mail.fromAddress
const SUBJECT = "Admission confirmed — pay your course fee on the USSU portal by 11 September 2026";
const TEMPLATE_ID = "fee-payment-selected";
const PORTAL_URL = "https://portal.ukssu.ac.in";
const CTA_URL = "https://portal.ukssu.ac.in/login";
const DUE_DATE = "11 September 2026";
const LOG_PATH = join(__dirname, ".fee-notice-log.json");
const SEND_DELAY_MS = 600; // ~1 min for ~92 recipients; keeps under Resend's rate limit

// --- args -------------------------------------------------------------------
const args = process.argv.slice(2);
const SEND = args.includes("--send");
const FORCE = args.includes("--force");
const SELF_CHECK = args.includes("--self-check");
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1]) || Infinity;
const TEST_TO = args.find((a) => a.startsWith("--test-to="))?.split("=")[1];

// --- helpers (copied from src/fees/fees.service.ts — do not import the Nest service) ---
function firstCycleLabel(cadence: FeeCadence): string {
  return cadence === "YEAR" ? "Year 1" : "Semester 1";
}
function feeTerm(cadence: FeeCadence): string {
  return cadence === "YEAR" ? "first year" : "first semester";
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- eligibility (pure, so --self-check can exercise it offline) ------------
type FeeStructureLike = { id: string; label: string; cadence: FeeCadence; requiresHostelOptIn: boolean };
type FeePaymentLike = { feeStructureId: string; cycleLabel: string; paid: boolean };
type StudentLike = {
  user: { email: string; fullName: string; ukssuId: string | null };
  programme: string | null;
  course: { name: string; feeStructures: FeeStructureLike[] } | null;
  admission: { hostelRequired: boolean | null } | null;
  feePayments: FeePaymentLike[];
};

type Eligibility =
  | { ok: true; courseName: string; term: string }
  | { ok: false; reason: "no-fee-structure" | "no-tuition-structure" | "fully-paid" };

function computeEligibility(s: StudentLike): Eligibility {
  const structures = s.course?.feeStructures ?? [];
  if (structures.length === 0) return { ok: false, reason: "no-fee-structure" };

  const tuition = structures.find((f) => f.label === "Tuition Fee") ?? structures.find((f) => !f.requiresHostelOptIn);
  if (!tuition) return { ok: false, reason: "no-tuition-structure" };

  const owesAny = structures.some((f) => {
    const opted = f.requiresHostelOptIn ? Boolean(s.admission?.hostelRequired) : true;
    if (!opted) return false;
    const payment = s.feePayments.find((p) => p.feeStructureId === f.id && p.cycleLabel === firstCycleLabel(f.cadence));
    return !payment?.paid;
  });
  if (!owesAny) return { ok: false, reason: "fully-paid" };

  return { ok: true, courseName: s.course?.name ?? s.programme ?? "your course", term: feeTerm(tuition.cadence) };
}

// --- send log -------------------------------------------------------------
type LogEntry = { email: string; ukssuId: string; resendId: string | null; status: "sent" | "failed"; sentAt: string };
function readLog(): LogEntry[] {
  if (!existsSync(LOG_PATH)) return [];
  try {
    return JSON.parse(readFileSync(LOG_PATH, "utf8"));
  } catch {
    return [];
  }
}
function writeLog(entries: LogEntry[]) {
  writeFileSync(LOG_PATH, JSON.stringify(entries, null, 2) + "\n");
}

// --- self-check ------------------------------------------------------------
function selfCheck() {
  const bss: FeeStructureLike[] = [
    { id: "t", label: "Tuition Fee", cadence: "SEMESTER", requiresHostelOptIn: false },
    { id: "h", label: "Hostel Fee", cadence: "SEMESTER", requiresHostelOptIn: true },
  ];
  const dsc: FeeStructureLike[] = [
    { id: "t", label: "Tuition Fee", cadence: "YEAR", requiresHostelOptIn: false },
    { id: "h", label: "Hostel Fee", cadence: "YEAR", requiresHostelOptIn: true },
  ];
  const base = (over: Partial<StudentLike>): StudentLike => ({
    user: { email: "x@x.com", fullName: "X", ukssuId: "UKSSU-1" },
    programme: "Bachelor of Sports Science",
    course: { name: "Bachelor of Sports Science", feeStructures: bss },
    admission: { hostelRequired: false },
    feePayments: [],
    ...over,
  });

  // 1. hostel not opted, nothing paid -> eligible, first semester
  const a = computeEligibility(base({}));
  assert(a.ok && a.term === "first semester", "case 1: eligible, first semester");

  // 2. hostel opted, tuition paid but hostel unpaid -> still eligible
  const b = computeEligibility(
    base({ admission: { hostelRequired: true }, feePayments: [{ feeStructureId: "t", cycleLabel: "Semester 1", paid: true }] }),
  );
  assert(b.ok === true, "case 2: hostel still owed -> eligible");

  // 3. hostel not opted, tuition paid -> fully paid, not eligible
  const c = computeEligibility(base({ feePayments: [{ feeStructureId: "t", cycleLabel: "Semester 1", paid: true }] }));
  assert(!c.ok && c.reason === "fully-paid", "case 3: fully paid -> skip");

  // 4. diploma -> first year
  const d = computeEligibility(base({ course: { name: "Diploma in Sports Coaching", feeStructures: dsc } }));
  assert(d.ok && d.term === "first year", "case 4: diploma -> first year");

  // 5. no fee structures -> skip
  const e = computeEligibility(base({ course: { name: "Ghost", feeStructures: [] } }));
  assert(!e.ok && e.reason === "no-fee-structure", "case 5: no fee structure -> skip");

  console.log("self-check: all 5 cases passed");
}
function assert(cond: boolean, label: string) {
  if (!cond) {
    console.error(`self-check FAILED: ${label}`);
    process.exit(1);
  }
  console.log(`  ok  ${label}`);
}

// --- main ----------------------------------------------------------------
async function main() {
  if (SELF_CHECK) {
    selfCheck();
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (SEND && !apiKey) {
    console.error("RESEND_API_KEY not set — cannot send.");
    process.exit(1);
  }
  const resend = apiKey ? new Resend(apiKey) : null;

  const students = await prisma.student.findMany({
    where: { user: { ukssuId: { not: null } }, courseId: { not: null } },
    include: {
      user: true,
      course: { include: { feeStructures: true } },
      admission: { select: { hostelRequired: true } },
      feePayments: true,
    },
  });

  const log = readLog();
  const alreadySent = new Set(log.filter((e) => e.status === "sent").map((e) => e.email));

  const skips = { "no-fee-structure": 0, "no-tuition-structure": 0, "fully-paid": 0, "already-sent": 0 };
  const eligible: { email: string; fullName: string; ukssuId: string; courseName: string; term: string }[] = [];

  for (const s of students) {
    const elig = computeEligibility(s as unknown as StudentLike);
    if (!elig.ok) {
      skips[elig.reason]++;
      continue;
    }
    if (!FORCE && alreadySent.has(s.user.email)) {
      skips["already-sent"]++;
      continue;
    }
    eligible.push({
      email: s.user.email,
      fullName: s.user.fullName,
      ukssuId: s.user.ukssuId!,
      courseName: elig.courseName,
      term: elig.term,
    });
  }

  const recipients = eligible.slice(0, LIMIT === Infinity ? undefined : LIMIT);

  console.log(`\n${SEND ? "SEND" : "DRY RUN"}  ·  template "${TEMPLATE_ID}"  ·  from ${FROM}\n`);
  for (const r of recipients) {
    console.log(`  ${r.email.padEnd(38)} ${r.ukssuId.padEnd(24)} ${r.term.padEnd(15)} ${r.courseName}`);
  }
  console.log(
    `\nEligible: ${eligible.length}${recipients.length !== eligible.length ? ` (sending ${recipients.length} due to --limit)` : ""}`,
  );
  console.log(
    `Skipped:  ${skips["already-sent"]} already-sent · ${skips["fully-paid"]} fully-paid · ` +
      `${skips["no-fee-structure"]} no-fee-structure · ${skips["no-tuition-structure"]} no-tuition-structure`,
  );

  if (!SEND) {
    console.log("\nNothing sent. Re-run with --send to send.\n");
    return;
  }
  if (TEST_TO) {
    console.log(`\n--test-to set: all mail redirected to ${TEST_TO}\n`);
  }

  let sent = 0;
  const failed: { email: string; error: string }[] = [];

  for (const r of recipients) {
    const variables = {
      fullName: r.fullName,
      ukssuId: r.ukssuId,
      courseName: r.courseName,
      feeTerm: r.term,
      username: r.email,
      portalUrl: PORTAL_URL,
      ctaUrl: CTA_URL,
      dueDate: DUE_DATE,
    };

    const to = TEST_TO ?? r.email;
    const outcome = await sendOne(resend!, to, variables);

    if (outcome.ok) {
      sent++;
      console.log(`  sent   ${to}  (${outcome.id})`);
      if (!TEST_TO) {
        log.push({ email: r.email, ukssuId: r.ukssuId, resendId: outcome.id, status: "sent", sentAt: new Date().toISOString() });
        writeLog(log);
      }
    } else {
      failed.push({ email: to, error: outcome.error });
      console.log(`  FAIL   ${to}  ${outcome.error}`);
      if (!TEST_TO) {
        log.push({ email: r.email, ukssuId: r.ukssuId, resendId: null, status: "failed", sentAt: new Date().toISOString() });
        writeLog(log);
      }
    }

    await sleep(SEND_DELAY_MS);
  }

  console.log(`\nSent:   ${sent}`);
  console.log(`Failed: ${failed.length}${failed.length ? " → " + failed.map((f) => `${f.email} (${f.error})`).join(", ") : ""}`);
  if (failed.length) process.exitCode = 1;
}

// resend.batch.send is not usable here — the batch endpoint rejects the
// `template` field in resend v6 (html/text/react only).
async function sendOne(
  resend: Resend,
  to: string,
  variables: Record<string, string>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await resend.emails.send({
        from: FROM,
        to,
        subject: SUBJECT,
        template: { id: TEMPLATE_ID, variables },
      });
      if (!result.error) return { ok: true, id: result.data?.id ?? "?" };

      const msg = `${result.error.name}: ${result.error.message}`;
      const isRateLimit = /rate.?limit|429/i.test(msg);
      if (isRateLimit && attempt === 1) {
        await sleep(5000);
        continue;
      }
      return { ok: false, error: msg };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === 1) {
        await sleep(5000);
        continue;
      }
      return { ok: false, error: msg };
    }
  }
  return { ok: false, error: "unreachable" };
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
