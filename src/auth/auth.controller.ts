import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "./strategies/jwt.strategy";

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto.identifier, dto.password, res);
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.resetPassword(dto.identifier, dto.newPassword, dto.confirmPassword);
  }

  @Public()
  @UseGuards(AuthGuard("jwt-refresh"))
  @Post("refresh")
  @HttpCode(200)
  async refresh(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.refresh(user, res);
    return { ok: true };
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    this.auth.logout(res);
    return { ok: true };
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
