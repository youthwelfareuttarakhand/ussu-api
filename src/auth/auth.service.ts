import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import type { Response } from "express";
import { UsersService } from "../users/users.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "./strategies/jwt.strategy";

const ACCESS_COOKIE = "ussu_token";
const REFRESH_COOKIE = "ussu_refresh";

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async validateCredentials(identifier: string, password: string) {
    const user = await this.users.findByEmailOrPhone(identifier);
    if (!user) throw new UnauthorizedException("Invalid credentials");
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid credentials");
    return user;
  }

  private payloadFor(user: { id: string; email: string; role: AuthUser["role"] }): AuthUser {
    return { sub: user.id, email: user.email, role: user.role };
  }

  async issueAndSetCookies(res: Response, user: { id: string; email: string; role: AuthUser["role"] }) {
    const payload = this.payloadFor(user);
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>("jwt.accessSecret"),
      expiresIn: this.config.get<string>("jwt.accessExpiry"),
    });
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>("jwt.refreshSecret"),
      expiresIn: this.config.get<string>("jwt.refreshExpiry"),
    });

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const nodeEnv = this.config.get<string>("nodeEnv");
    const secure = nodeEnv === "production" || nodeEnv === "staging";
    const sameSite = secure ? "none" : "lax";
    const domain = this.config.get<string>("cookieDomain");
    res.cookie(ACCESS_COOKIE, accessToken, { httpOnly: true, secure, sameSite, domain, maxAge: 2 * 60 * 60 * 1000 });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      domain,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private cookieClearOptions() {
    const nodeEnv = this.config.get<string>("nodeEnv");
    const secure = nodeEnv === "production" || nodeEnv === "staging";
    const sameSite = secure ? ("none" as const) : ("lax" as const);
    const domain = this.config.get<string>("cookieDomain");
    return { httpOnly: true, secure, sameSite, domain };
  }

  async login(identifier: string, password: string, res: Response) {
    const user = await this.validateCredentials(identifier, password);
    await this.issueAndSetCookies(res, user);
    return this.payloadFor(user);
  }

  // ponytail: doesn't check the incoming refresh token against RefreshToken.tokenHash
  // (no revocation-on-refresh yet) — a valid signature + unexpired JWT is enough for v1.
  // Add hash lookup + rotation once you need to revoke individual sessions (e.g. "log out
  // other devices"), not just wait out the 7-day expiry.
  async refresh(refreshUser: AuthUser, res: Response) {
    const user = await this.users.findById(refreshUser.sub);
    if (!user) throw new UnauthorizedException();
    await this.issueAndSetCookies(res, user);
  }

  // No verification step by design (see docs/superpowers/specs/2026-08-13-forgot-password-design.md) —
  // returns the same message whether or not `identifier` matched a real account, so this
  // can't be used to enumerate which emails/phones have accounts.
  async resetPassword(identifier: string, newPassword: string, confirmPassword: string) {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException("Passwords do not match");
    }
    const user = await this.users.findByEmailOrPhone(identifier);
    if (user) {
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await this.users.updatePasswordHash(user.id, passwordHash);
    }
    return { message: "If an account exists for that email or phone, the password has been updated." };
  }

  logout(res: Response) {
    const options = this.cookieClearOptions();
    res.clearCookie(ACCESS_COOKIE, options);
    res.clearCookie(REFRESH_COOKIE, options);
  }
}
