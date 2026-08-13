# Forgot Password — Design

## Context
The login modal (`ussu-web`, `AdmissionsHero.tsx`) has no password-recovery path today. Users locked out of their account (student or staff/admin) have no self-service option. This adds one, using identifier (email or phone) + new password + confirm password — no email/OTP verification step, by explicit decision (see Security note below).

## Security note (explicit tradeoff, acknowledged)
This flow lets anyone who knows an account's email/phone **and** full name **and** date of birth reset that account's password, with no email/OTP verification. This was flagged during design and deliberately accepted as-is. Update: after initial ship, `fullName` + `dob` were added as required match-against-file fields (still no OTP/email-link step) to raise the bar above "know the identifier alone." Mitigations that don't change the UX:
- The endpoint always returns the same generic success message regardless of whether the identifier matched a real account, or whether the account matched but fullName/dob didn't — a mismatch on any field is indistinguishable from "no such account" in the response. Prevents using it as an account/field-enumeration oracle.
- `fullName` match is case/whitespace-insensitive (trimmed, lowercased); `dob` compares by date only.
- No new attack surface beyond what's already true of `/auth/login` (which also has no rate limiting).

**Known gap, explicitly out of scope:** no rate limiting exists on any `/auth/*` route in this codebase today (verified — no throttler package installed, no guard applied). This endpoint inherits that gap. A scripted attacker could enumerate/brute-force resets. Flagging for a future pass if this becomes a problem; not fixed here per user's scope decision.

## Backend — `ussu-api`
No schema migration needed — reuses existing `User.passwordHash` and `UsersService.findByEmailOrPhone` (same lookup `/auth/login` already uses), same `bcrypt.hash(..., 10)` pattern already used in `applications.service.ts`.

**New route:** `POST /auth/forgot-password` in `src/auth/auth.controller.ts` — public, no guard (mirrors `/auth/login`, which is also public).

**New DTO** `src/auth/dto/forgot-password.dto.ts`:
```ts
export class ForgotPasswordDto {
  @IsString() @MinLength(3) identifier!: string;
  @IsString() @MinLength(1) fullName!: string;
  @IsDateString() dob!: string;
  @IsString() @MinLength(8) newPassword!: string;
  @IsString() @MinLength(8) confirmPassword!: string;
}
```

**New service method** `AuthService.resetPassword(identifier, fullName, dob, newPassword, confirmPassword)`:
1. If `newPassword !== confirmPassword` → throw `BadRequestException("Passwords do not match")`.
2. Look up user via `UsersService.findByEmailOrPhone(identifier)` — returns `null` on miss, doesn't throw.
3. Match check: user exists **and** `user.fullName.trim().toLowerCase() === fullName.trim().toLowerCase()` **and** `user.dob` (date-only) `=== dob` (date-only).
4. If all match: `bcrypt.hash(newPassword, 10)`, then `UsersService.updatePasswordHash(user.id, passwordHash)`.
5. Always return `{ message: "If those details match an account, the password has been updated." }` — identical response whether the identifier didn't match, or matched but fullName/dob didn't. Mismatched `newPassword`/`confirmPassword` is the only case with a *different* response (400 — client input error, not an enumeration signal).

## Frontend — `ussu-web`
Component: `packages/ui/src/AdmissionsHero.tsx`, which already drives a `stage` state machine (`"register" | "login"`).

- Add a third stage: `"forgot"`.
- On the `"login"` stage, add a "Forgot password?" text link under the password field → `setStage("forgot")`.
- New `"forgot"` stage renders: identifier field, full-name field, date-of-birth field, new-password field, confirm-password field, Submit button.
- Client-side validation before submit (mirrors backend): new/confirm match, both ≥8 chars. Show inline error if not, don't hit the API.
- On submit: `apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify({ identifier, fullName, dob, newPassword, confirmPassword }) })`.
- On success: show the returned generic message briefly, then `setStage("login")`.
- On error (e.g. backend 400 for mismatched passwords slipping past client validation): show the `ApiError` message inline via the same pattern the login/register stages already use.

## Testing
Manual, against a real test/staging account (no automated test infra exists for this flow):
1. Reset a known test account's password through the new UI flow.
2. Confirm old password now fails `/auth/login`.
3. Confirm new password succeeds.
4. Submit an unknown identifier — confirm the generic success message still shows (no "user not found" leak).
5. Submit mismatched new/confirm passwords — confirm inline error, no API call made (client-side), and confirm the backend also rejects it if called directly (e.g. via curl) bypassing the client check.
