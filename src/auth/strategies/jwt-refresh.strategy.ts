import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, type StrategyOptionsWithoutRequest } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import type { AuthUser } from "./jwt.strategy";

function fromCookie(cookieName: string) {
  return (req: Request): string | null => req?.cookies?.[cookieName] ?? null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, "jwt-refresh") {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: fromCookie("ussu_refresh"),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("jwt.refreshSecret") as string,
    } as StrategyOptionsWithoutRequest);
  }

  validate(payload: AuthUser): AuthUser {
    return payload;
  }
}
