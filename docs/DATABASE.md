# USSU Database Reference

> **Single source of truth for the schema.** This file must be updated in the same commit as any change to `prisma/schema.prisma`. A pre-commit hook (`scripts/git-hooks/pre-commit`, wired up via `npm install`'s `prepare` script) blocks commits that touch the schema without also touching this file.

## Overview

Stack: PostgreSQL + Prisma. One migration baseline (`20260706090425_init`) plus incremental migrations after it — see `prisma/migrations/` for history, this file for current shape.

`User` is the hub of the schema: every person in the system (student, staff, admin) is a `User` row, with `Student`/`Staff` as optional 1:1 extensions holding role-specific fields. `Admission` hangs off `Student`. Signup is free and synchronous — there is no pending/holding table between form submission and a real account; see the [Signup → Admission → Approval lifecycle](#signup--admission--approval-lifecycle) section.

## Enums

### `Role`
`STUDENT | STAFF | ADMIN` — what kind of account a `User` is. Drives which of `Student`/`Staff` gets created alongside it, and is used in `@Roles()` guards throughout the API.

### `AdmissionStatus`
`SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED` — the staff review outcome for an `Admission`, set via `PATCH /admissions/:id/status`. **`APPROVED` is a real gate**: it's the only thing that issues `ukssuId`, and it's only allowed once `Admission.paid` is `true` (`AdmissionsService.updateStatus`). `REJECTED` has no side effects beyond the status fields. `SUBMITTED`/`UNDER_REVIEW` are informational only.

### `DocumentType`
`PHOTO | SIGNATURE | MARKSHEET_10 | MARKSHEET_12 | AADHAR | CATEGORY_CERTIFICATE | SPORTS_CERTIFICATE | MEDICAL_FITNESS_CERTIFICATE | GRADUATION_CERTIFICATE | OTHER` — what a `Document` row represents. `CATEGORY_CERTIFICATE` is only required for reserved categories (SC/ST/OBC-NCL/EWS/PwD); `GRADUATION_CERTIFICATE` is only required for Diploma in Sports Coaching applicants. Everything else is mandatory for all applicants (per `USSU_Online_Application_Form_2026-27`).

### `ProgrammeLevel`
`UG | PG | DIPLOMA` — the three top-level categories of programme USSU offers. Used on `Course.level`.

## Tables

### `User`
The account record for every person in the system — students, staff, and admins alike.

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | `String` | PK, `cuid()` | Internal primary key. Not shown to users — see `ukssuId` for the human-facing identifier. |
| `email` | `String` | unique | Login identifier. |
| `passwordHash` | `String` | — | bcrypt hash. **Never** store or log the plaintext password. |
| `role` | `Role` | — | Determines which of `student`/`staff` relations is populated. |
| `ukssuId` | `String?` | unique (nullable) | The primary human-facing identifier — see [UKSSU ID](#ukssu-id) below. Staff/admin get one at creation. Self-registered students get `NULL` until **staff APPROVE their (paid) admission** (`AdmissionsService.updateStatus`) — registering, and even paying the admission fee, is not the same as being admitted. |
| `registrationNumber` | `String?` | unique (nullable) | The applicant's reference number, issued immediately at web signup — see [Registration Number](#registration-number) below. Distinct namespace/format from `ukssuId`; does **not** imply admission. `NULL` for staff/admin/seed accounts, which don't go through the self-service signup flow. |
| `fullName` | `String` | not null | Applicant/user's full name. |
| `phone` | `String?` | unique (nullable) | 10-digit India mobile number. Nullable so seeded/manually-created staff and admin accounts without a phone on file don't collide — Postgres treats multiple `NULL`s as distinct under a unique constraint. Always set for applicants created via the admissions flow. |
| `dob` | `DateTime?` | — | Date of birth. Nullable for the same reason as `phone`. |
| `createdAt` / `updatedAt` | `DateTime` | — | Standard timestamps. |

Relations: `student Student?`, `staff Staff?` (1:1, populated based on `role`), `refreshTokens RefreshToken[]`.

### `Student`
Student-specific fields, 1:1 with a `User` where `role = STUDENT`.

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | `String` | PK, `cuid()` | |
| `userId` | `String` | unique, FK → `User.id` | |
| `rollNumber` | `String?` | unique (nullable) | The official university roll number — distinct from `ukssuId`. Assigned manually by staff, not at signup time. |
| `programme` | `String?` | — | Free-text description of the student's declared programme (e.g. `"B.Sc. Sports Science"`). `NULL` until the applicant picks a course in the dashboard admission form's step 1 (`AdmissionsService`, set to the matching `Course.name`). |
| `countryId` | `String?` | FK → `Country.id` | Set at registration time (`ApplicationsService.create`). Known before the `Admission` row even exists — `Admission` is only created later, when the applicant starts the dashboard admission form. |
| `stateId` | `String?` | FK → `State.id` | Only set when `country` is India (enforced by the frontend hiding the State field otherwise). |
| `programmeLevel` | `ProgrammeLevel?` | — | The UG/PG/Diploma level for `programme` above, set alongside it. |

Relations: `user User`, `admission Admission?`, `country Country?`, `state State?`.

### `Staff`
Staff-specific fields, 1:1 with a `User` where `role = STAFF`.

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | `String` | PK, `cuid()` | |
| `userId` | `String` | unique, FK → `User.id` | |
| `department` | `String?` | — | |
| `designation` | `String?` | — | |

### `AdmissionBatch`
One row per admission cycle (e.g. `"2026-2027"`). Only one batch is ever active at a time — `createBatch` (`AdmissionsService`) deactivates all others in the same transaction as activating the new one. The dashboard admission form never offers a batch picker; it just attaches whichever batch is currently active (`GET /reference/active-batch`, public). Also drives the "ADMISSIONS 2026–27"-style label shown across `ussu-web`.

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | `String` | PK, `cuid()` | |
| `label` | `String` | unique | e.g. `"2026-2027"`. |
| `isActive` | `Boolean` | default `false` | At most one `true` row at a time (app-enforced, not a DB constraint). |
| `startedAt` | `DateTime` | default `now()` | |

### `Admission`
Created as a **draft** the moment an applicant first opens the dashboard admission form (`GET /admissions/draft`, get-or-create) — not at registration time. Filled in progressively across the 6-step form (personal detail columns below, plus the related `ParentDetails`/`AddressDetails`/`AcademicDetails`/`SportsDetails`/`Document` rows), then finalized by paying the admission fee (`paid` flips to `true`, `AdmissionsService.verifyDraftPayment`). `ukssuId` is **not** issued at payment — only once staff `APPROVE` via `status`. See [UKSSU ID](#ukssu-id) and the [lifecycle](#signup--admission--approval-lifecycle) section below.

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | `String` | PK, `cuid()` | |
| `studentId` | `String` | unique, FK → `Student.id` | One admission per student. |
| `batchId` | `String` | FK → `AdmissionBatch.id` | The batch active at the moment this draft was created. |
| `status` | `AdmissionStatus` | default `SUBMITTED` | See the enum's own note above — `APPROVED` is the real ukssuId-issuance gate. |
| `paid` | `Boolean` | default `false` | `true` once the admission fee payment is verified. This unlocks staff review (Approve/Reject only appear once paid) — it is **not** the ukssuId gate by itself, `status = APPROVED` is. |
| `nationality`, `aadharNumber`, `category`, `gender`, `bloodGroup` | mixed, all nullable | — | Personal-detail snapshot from step 1 of the admission form. Course/programme/country/state are **not** duplicated here — see `Student.country`/`Student.state`/`Student.programme`, set earlier at registration. `category` uses the official codes `UR`/`OBC-NCL`/`SC`/`ST`/`EWS`/`PwD` and drives the admission fee (see [fee](#admission-fee)) and whether `CATEGORY_CERTIFICATE` is required. |
| `uttarakhandDomicile` | `Boolean?` | — | "Uttarakhand Domicile (Yes/No)" on the official form. |
| `mediumOfInstruction` | `String?` | — | `"English"` or `"Hindi"`. |
| `hostelRequired` | `Boolean?` | — | "Hostel Accommodation Required". |
| `coachingDiscipline` | `String?` | — | Only meaningful when the applicant's programme is Diploma in Sports Coaching — one of Badminton/Basketball/Hockey/Ice Sports/Karate/Swimming/Taekwondo. |
| `declarationAcceptedAt` | `DateTime?` | — | Set when the applicant checks the declaration checkbox on the final step, just before the admission-fee Razorpay order is created (`POST /admissions/draft/pay` requires `declarationAccepted: true` in the body). |
| `razorpayOrderId` | `String?` | unique | The Razorpay order for the admission fee — the only payment in the flow, signup itself is free. Set by `POST /admissions/draft/pay`. |
| `razorpayPaymentId` | `String?` | — | Set once the admission-fee payment is verified. |
| `amountPaid` | `Int?` | — | Admission fee in paise, snapshotted at payment time (category-dependent — see [fee](#admission-fee)). |
| `paidAt` | `DateTime?` | — | |
| `submittedAt` | `DateTime` | default `now()` | Draft-creation time, despite the name — kept for backward compatibility with existing staff-list sorting. |
| `reviewedAt` / `reviewedBy` | `DateTime?` / `String?` | — | Set by staff/admin on status change (`PATCH /admissions/:id/status`). |

Relations: `parentDetails ParentDetails?`, `addressDetails AddressDetails?`, `academicDetails AcademicDetails?`, `sportsDetails SportsDetails?` (each 1:1, one per admission form step), `documents Document[]`.

### `ParentDetails`, `AddressDetails`, `AcademicDetails`, `SportsDetails`
1:1 with `Admission`, one per dashboard admission form step (Parent Details / Address Details / Academic Details / Sports Achievement respectively). All fields nullable — populated incrementally as the applicant completes each step via `PATCH /admissions/draft`.

- `ParentDetails`: `fatherName`, `motherName`, `guardianName` (optional, "if applicable"), `guardianPhone`, `guardianEmail`, `occupation`.
- `AddressDetails`: `line1`, `line2`, `city`, `state`, `pincode` — a single Correspondence Address, matching the official form (no permanent/correspondence split).
- `AcademicDetails`: `tenthBoard`, `tenthRollNo`, `tenthYear`, `tenthPercentage`, `twelfthBoard`, `twelfthStream` (optional), `twelfthYear`, `twelfthPercentage`, `gapYear`, plus Diploma-only optional graduation fields `graduationDiscipline`, `graduationInstitution`, `graduationYear`, `graduationStatus` (`"APPEARING" | "PASSED"`), `graduationPercentage` (not DB-enforced to Diploma applicants, gated in the UI/DTO). When `graduationStatus` is `"APPEARING"`, `graduationPercentage` is left `NULL` (result pending) and the UI skips requiring the Graduation Certificate upload.
- `SportsDetails`: `primarySport`, `highestLevel`, `positionHeld`, `certifyingAuthority`, `yearOfAchievement`, `eminentSportsperson` — Section 4 of the official form, mandatory for all applicants (Diploma applicants held to a higher off-platform bar: two-time National/Inter-University participation).

### `Document`
Many-to-one with `Admission` — one row per uploaded file (photo, signature, marksheets, certificates), step 6 of the admission form.

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | `String` | PK, `cuid()` | |
| `admissionId` | `String` | FK → `Admission.id`, indexed | |
| `type` | `DocumentType` | — | See the enum above. |
| `filename` | `String` | not null | Original filename, for display. |
| `url` | `String?` | — | Set when stored in Azure Blob (production only). |
| `data` / `mimeType` | `Bytes?` / `String?` | — | Set when stored as raw bytes in Postgres — the staging/local-dev fallback (see below). Exactly one of `url` or (`data`+`mimeType`) is set per row. |
| `uploadedAt` | `DateTime` | default `now()` | |

One row per `(admissionId, type)` in practice — `AdmissionsService.uploadDocument` deletes any existing document of the same type before inserting the new one ("Replace", not "add another"), so there's no `@@unique` constraint but the app never leaves duplicates.

**Storage backend** (`src/storage/storage.service.ts`): decided per-request by which env vars are set. Production `ussu-api` has `AZURE_STORAGE_CONNECTION_STRING`/`AZURE_STORAGE_CONTAINER` configured (Azure Blob Storage, private container). Staging/local dev deliberately leave these unset — `StorageService` then falls back to storing raw bytes directly on the `Document` row (`data`+`mimeType`), so applicant documents from testing can never land in the real prod storage account and no external service is needed for local development. `POST /admissions/draft/documents` (multipart, 5MB file size cap) and `DELETE /admissions/draft/documents/:id` are the only entry points.

### `Notice`
Simple announcements list (title/body), unrelated to the admissions flow.

### `RefreshToken`
| Column | Type | Meaning |
|---|---|---|
| `tokenHash` | `String` | **Stores a hash of the refresh token, never the raw token.** A raw token in the DB would let anyone with read access to the table impersonate any user by replaying it. |
| `expiresAt` | `DateTime` | |

### `Country`
Seeded reference list for the applicant's country of residence (registration form) and the admission form's Nationality field — see `prisma/seed.ts` / `prisma/data/countries.ts` (~195 rows). A real table, not an enum, since the list is long and easier to seed/query.

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | `String` | PK, `cuid()` | |
| `name` | `String` | unique | e.g. `"India"`. |

Relations: `states State[]`.

### `State`
States/UTs, scoped to a `Country`. Only India is seeded (`prisma/data/india-states.ts`, all 28 states + 8 UTs) — the registration form only asks for State once the applicant picks India as their Country, so other countries have no rows here.

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | `String` | PK, `cuid()` | |
| `name` | `String` | unique per `countryId` | e.g. `"Uttarakhand"`. |
| `countryId` | `String` | FK → `Country.id` | |

Relations: `country Country`.

### `Course`
Concrete courses offered under each `ProgrammeLevel`. Grows over time — new courses get added, and it may later need fields like fee, duration, or seat count — so it's a real table, not an enum.

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | `String` | PK, `cuid()` | |
| `name` | `String` | unique | e.g. `"B.Sc. Sports Science"`. |
| `level` | `ProgrammeLevel` | — | Which top-level programme category this course belongs to. |

Seeded via `prisma/seed.ts` — currently 3 UG courses (B.Sc. Sports Science, B.Sc. Sports Management, B.Sc. Sports Journalism) and 1 Diploma course (Diploma in Sports Coaching). No PG courses exist yet.

### `UkssuIdCounter`
The atomic sequence source for generating UKSSU IDs.

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `year` | `Int` | PK (composite with `roleCode`) | |
| `roleCode` | `String` | PK (composite with `year`) | `"STU"`, `"STF"`, or `"ADM"`. |
| `value` | `Int` | default `0` | The last-issued sequence number for this (year, roleCode) pair. |

One row per (year, roleCode) combination, created lazily the first time it's needed. See [UKSSU ID](#ukssu-id) below for the generation algorithm.

### `RegistrationNumberCounter`
The atomic sequence source for generating registration numbers.

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `year` | `Int` | PK | No `roleCode` dimension — registration numbers are only ever issued to self-registered students. |
| `value` | `Int` | default `0` | The last-issued sequence number for this year. |

One row per year, created lazily the first time it's needed. See [Registration Number](#registration-number) below for the generation algorithm.

### `PageVisit`
One row per page load on `ussu-web`, pinged from the client (`VisitPing` component in `packages/ui`, mounted in the root layout) on every route change via `POST /analytics/visit`. Deliberately simple — a raw hit log, not a real analytics SDK. Mirrors how the sibling KheloUK platform tracks traffic: a plain self-hosted counter table, not PostHog/GA (confirmed neither exists in either codebase).

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | `String` | PK, `cuid()` | |
| `path` | `String` | not null | The pathname visited. |
| `ip` | `String` | not null | Client IP, read from `x-forwarded-for` (falling back to the raw socket address). Used to compute *unique* visitor counts at query time — uniqueness isn't enforced by a DB constraint, every hit is stored and `DISTINCT ip` is computed per query (`AnalyticsService.uniqueIpCount`). |
| `createdAt` | `DateTime` | default `now()` | Indexed, along with `ip`, since the admin dashboard queries both by date range and by distinct IP. |

Powers `GET /analytics/overview` (registration/admission counts + a 7-day registration trend, STAFF/ADMIN only) and `GET /analytics/visitors` (unique visitor totals for the last 7 days/month/year + a 7-day trend, STAFF/ADMIN only), both consumed by the admin dashboard in `ussu-portal-web`.

### `ContactMessage`
One row per `/contact` form submission on `ussu-web` (`POST /contact`, public). Purely an inbound-enquiry log — no relation to `Admission`/`Student`, since a sender isn't necessarily a registered applicant. Persisted so submissions can be reviewed later even if the notification email fails; the email leg (`MailService.sendContactNotification`) is fire-and-forget and never blocks or rolls back the write.

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | `String` | PK, `cuid()` | |
| `name` | `String` | not null | |
| `email` | `String` | not null | |
| `phone` | `String?` | nullable | Optional field on the form. |
| `subject` | `String?` | nullable | Free-text category from the form's subject select (e.g. "Admissions", "Media"). |
| `message` | `String` | not null | |
| `createdAt` | `DateTime` | default `now()`, indexed | |

## UKSSU ID

**Format:** `UKSSU-<year>-<roleCode>-<6-digit zero-padded sequence>`, e.g. `UKSSU-2026-STU-000123`.

- `year` — the calendar year the account was created (not the applicant's admission cycle if those ever diverge; this is account-creation year).
- `roleCode` — `STU` (student), `STF` (staff), `ADM` (admin).
- Sequence resets to 1 for each new (year, roleCode) pair and never repeats within that pair.

**Staff/admin** get one immediately at creation. **Students** get one only once **staff APPROVE their (already-paid) admission** — `AdmissionsService.updateStatus`, transitioning `status` to `APPROVED`. This requires `Admission.paid` to already be `true` (the admission fee is paid first, then the applicant is called for an offline written + physical test, then staff approve or reject). Not at registration (registering only issues a [Registration Number](#registration-number)), and not automatically at payment either — payment alone no longer issues an ID. Once issued, it never changes. This is the identifier meant for humans to use — quote it to support staff, print it on ID cards, look someone up by it — rather than the internal `cuid()` primary key.

**Generation algorithm** (`UkssuService.nextId`, `src/ukssu/ukssu.service.ts`), always run inside the same database transaction as the `User` update it's part of (the staff-approval transaction for students, or the account-creation transaction for staff/admin-style immediate issuance):

1. Attempt an atomic `UPDATE UkssuIdCounter SET value = value + 1 WHERE year = $1 AND roleCode = $2 RETURNING value` (via Prisma's `update` with `{ increment: 1 }`). Postgres row-locks the counter row for this, so two concurrent requests in the same (year, roleCode) can never receive the same number.
2. If no row exists yet for this (year, roleCode) — the first of that kind this year — the `UPDATE` affects zero rows (Prisma throws `P2025 Not Found`). Fall back to `INSERT ... VALUES (year, roleCode, 1)`.
3. If *that* insert also fails with a unique-constraint violation (`P2002`) — another concurrent request won the race to create the first row — retry the atomic `UPDATE` from step 1, which will now succeed.
4. Format the result as `UKSSU-${year}-${roleCode}-${value.toString().padStart(6, "0")}`.

`AdmissionsService.updateStatus` is also idempotent against double-approval: if `user.ukssuId` is already set (e.g. staff double-clicks Approve), it's reused rather than a new one being generated.

No raw SQL is needed anywhere in this — it's all standard Prisma atomic operations.

## Registration Number

**Format:** `REG-<year>-<6-digit zero-padded sequence>`, e.g. `REG-2026-000123` — deliberately a different prefix/shape from `UKSSU-2026-STU-000123` so the two are never confused.

- Issued to **every** self-registered student immediately at signup (inside `ApplicationsService.create`'s transaction), regardless of whether their admission is ever completed or approved.
- Completely separate from `ukssuId`: registering ≠ being admitted. A student may hold a registration number for months while `Admission` doesn't even exist yet, or sits at `status = SUBMITTED` unpaid, with `ukssuId` remaining `NULL` the whole time.
- Staff/admin accounts never get a registration number (they're not created via the self-service signup flow).
- Sequence resets to 1 each new year and never repeats within that year.

**Generation algorithm** (`RegistrationNumberService.nextNumber`, `src/ukssu/registration-number.service.ts`), always run inside the same transaction as the `User` row it's assigned to (`ApplicationsService.create`) — same atomic-counter pattern as `UkssuService.nextId`, just against `RegistrationNumberCounter` and without the role-code dimension:

1. Atomic `UPDATE RegistrationNumberCounter SET value = value + 1 WHERE year = $1 RETURNING value`.
2. If no row exists for this year yet, fall back to `INSERT ... VALUES (year, 1)`.
3. If that insert races and loses (`P2002`), retry the atomic `UPDATE` from step 1.
4. Format as `REG-${year}-${value.toString().padStart(6, "0")}`.

## Admission fee

Category-based, per the official application form — computed server-side from `Admission.category` (`AdmissionsService.feeForCategory`), never trusted from the client:

- **₹1,000** (`razorpay.admissionFeeFullPaise`, 100000 paise) — `UR`, `OBC-NCL`, `EWS`, or unset/unrecognized category.
- **₹500** (`razorpay.admissionFeeConcessionPaise`, 50000 paise) — `SC`, `ST`, `PwD`.

Recomputed fresh from `Admission.category` both when the Razorpay order is created (`createDraftPaymentOrder`) and when the payment is verified (`verifyDraftPayment`), so the two stay consistent even if nothing else changes in between. Signup itself is free — this is the only payment in the entire flow.

## Signup → Admission → Approval lifecycle

One linear, staff-gated flow. Signup is free and synchronous; the admission fee is the only payment; a UKSSU ID is only ever issued after staff review.

### Phase 1 — Signup (`src/applications`)

1. **Stages 1 + 2 (client-side only, nothing in the DB yet).** The applicant fills in basic details (name, email, phone, DOB, country, state, programme level) and chooses a password. The specific course isn't chosen yet — that happens later, in the dashboard admission form's step 1.
2. **`POST /applications`.** Checks email/phone aren't already taken by an existing `User`, hashes the password, and — inside one transaction — issues a registration number (`RegistrationNumberService.nextNumber`) and creates the `User` (`registrationNumber` set, `ukssuId` left `NULL`) with a nested `Student` (`countryId`/`stateId`/`programmeLevel` set; `programme` left `NULL` until the course is chosen). Sets auth cookies directly on the response (`AuthService.issueAndSetCookies`) — the applicant is logged in immediately, no separate login call needed. No `Admission` row is created here — that happens later, in Phase 2.
3. **Done.** The applicant lands on a success screen showing their registration number, with a link to the dashboard — already authenticated.

### Phase 2 — Admission (`src/admissions`, dashboard 6-step form)

1. **`GET /admissions/draft`.** Get-or-create: if no `Admission` exists yet for this student, one is created tied to whichever `AdmissionBatch` is currently active (`isActive: true`) — 400 if no batch is open. Returns the draft with all nested `parentDetails`/`addressDetails`/`academicDetails`/`sportsDetails`/`documents`, letting the wizard resume where the applicant left off.
2. **`PATCH /admissions/draft`** (repeatable, one call per completed step). Accepts whichever of `personal`/`parent`/`address`/`academic`/`sports` sections the applicant just filled in; each is upserted independently. Rejected with 409 once `paid` is `true` — a completed admission can't be edited.
3. **Document uploads** — `POST /admissions/draft/documents` (multipart). Which documents are required depends on `category` (Category Certificate, if reserved) and programme (Graduation Certificate, if Diploma) — enforced in the `ussu-web` wizard, not the DB.
4. **`POST /admissions/draft/pay`.** Requires `declarationAccepted: true` in the body (400 otherwise) — sets `declarationAcceptedAt`. Creates a Razorpay order for the [admission fee](#admission-fee), sets `Admission.razorpayOrderId`.
5. **`POST /admissions/draft/verify-payment`.** Verifies the HMAC signature, and — in one transaction — sets `paid: true` + `amountPaid`/`paidAt`/`razorpayPaymentId`. **Does not** issue `ukssuId`. Idempotent: re-checks `paid` inside the transaction so a retry can't double-charge.
6. **Done (pending review).** The applicant sees a "Registration Complete — you'll be contacted for a written and physical test" message. No UKSSU ID yet, no portal access change.

### Phase 3 — Staff review (`ussu-portal-web`, `PATCH /admissions/:id/status`)

1. Staff/admin see all admissions (`GET /admissions`) with a paid/unpaid indicator, and open the detail view for a specific applicant (`GET /admissions/:id`).
2. Once `paid` is `true`, an Approve/Reject action appears (`ussu-portal-web`'s `AdmissionReviewActions` — Approve is two-tap-confirmed to guard against misclicks, since it's effectively irreversible).
3. **Approve** (`status → APPROVED`): rejected with 400 if `paid` is still `false`. Otherwise, in one transaction, issues `ukssuId` (`UkssuService.nextId`, role `STUDENT`) if not already set, then updates `status`/`reviewedAt`/`reviewedBy`.
4. **Reject** (`status → REJECTED`): just updates `status`/`reviewedAt`/`reviewedBy`, no side effects, no re-apply flow.
5. The student's dashboard reflects the outcome (Approved + UKSSU ID shown, or Rejected) the next time it loads `GET /admissions/me`.
