import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, type StrategyOptionsWithoutRequest } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import type { Role } from "@prisma/client";

export type AuthUser = {
  sub: string;
  email: string;
  role: Role;
};

function fromCookie(cookieName: string) {
  return (req: Request): string | null => req?.cookies?.[cookieName] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: fromCookie("ussu_token"),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("jwt.accessSecret") as string,
    } as StrategyOptionsWithoutRequest);
  }

  validate(payload: AuthUser): AuthUser {
    return payload;
  }
}
