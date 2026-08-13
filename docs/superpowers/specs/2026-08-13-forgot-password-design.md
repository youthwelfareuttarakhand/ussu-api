# Forgot Password — Design

## Context
The login modal (`ussu-web`, `AdmissionsHero.tsx`) has no password-recovery path today. Users locked out of their account (student or staff/admin) have no self-service option. This adds one, using identifier (email or phone) + new password + confirm password — no email/OTP verification step, by explicit decision (see Security note below).

## Security note (explicit tradeoff, acknowledged)
This flow lets anyone who knows an account's email or phone number reset that account's password, with no proof of ownership. This was flagged during design and deliberately accepted as-is — no verification step, to keep the flow simple. Two mitigations are included that don't change the UX:
- The endpoint always returns the same generic success message regardless of whether the identifier matched a real account, to prevent using it as an account-enumeration oracle.
- No new attack surface beyond what's already true of `/auth/login` (which also has no rate limiting).

**Known gap, explicitly out of scope:** no rate limiting exists on any `/auth/*` route in this codebase today (verified — no throttler package installed, no guard applied). This endpoint inherits that gap. A scripted attacker could enumerate/brute-force resets. Flagging for a future pass if this becomes a problem; not fixed here per user's scope decision.

## Backend — `ussu-api`
No schema migration needed — reuses existing `User.passwordHash` and `UsersService.findByEmailOrPhone` (same lookup `/auth/login` already uses), same `bcrypt.hash(..., 10)` pattern already used in `applications.service.ts`.

**New route:** `POST /auth/forgot-password` in `src/auth/auth.controller.ts` — public, no guard (mirrors `/auth/login`, which is also public).

**New DTO** `src/auth/dto/forgot-password.dto.ts`:
```ts
export class ForgotPasswordDto {
  @IsString() @MinLength(3) identifier!: string;
  @IsString() @MinLength(8) newPassword!: string;
  @IsString() @MinLength(8) confirmPassword!: string;
}
```

**New service method** `AuthService.resetPassword(dto: ForgotPasswordDto)`:
1. If `newPassword !== confirmPassword` → throw `BadRequestException("Passwords do not match")`.
2. Look up user via `UsersService.findByEmailOrPhone(dto.identifier)`. Needs to tolerate "not found" without throwing (check current behavior — `/auth/login`'s path may throw `UnauthorizedException` on miss; this method must catch/handle that and treat as "no match" rather than propagating).
3. If a user was found: `bcrypt.hash(dto.newPassword, 10)`, then `UsersService` update `passwordHash` for that user.
4. Always return `{ message: "If an account exists for that email or phone, the password has been updated." }` — same response whether or not a match was found, whether or not passwords matched is the only case with a *different* response (400, since that's a client input error, not an enumeration signal).

## Frontend — `ussu-web`
Component: `packages/ui/src/AdmissionsHero.tsx`, which already drives a `stage` state machine (`"register" | "login"`).

- Add a third stage: `"forgot"`.
- On the `"login"` stage, add a "Forgot password?" text link under the password field → `setStage("forgot")`.
- New `"forgot"` stage renders: identifier field, new-password field, confirm-password field, Submit button.
- Client-side validation before submit (mirrors backend): new/confirm match, both ≥8 chars. Show inline error if not, don't hit the API.
- On submit: `apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify({ identifier, newPassword, confirmPassword }) })`.
- On success: show the returned generic message briefly, then `setStage("login")`.
- On error (e.g. backend 400 for mismatched passwords slipping past client validation): show the `ApiError` message inline via the same pattern the login/register stages already use.

## Testing
Manual, against a real test/staging account (no automated test infra exists for this flow):
1. Reset a known test account's password through the new UI flow.
2. Confirm old password now fails `/auth/login`.
3. Confirm new password succeeds.
4. Submit an unknown identifier — confirm the generic success message still shows (no "user not found" leak).
5. Submit mismatched new/confirm passwords — confirm inline error, no API call made (client-side), and confirm the backend also rejects it if called directly (e.g. via curl) bypassing the client check.
