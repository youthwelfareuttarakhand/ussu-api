import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthUser } from "../../auth/strategies/jwt.strategy";

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
