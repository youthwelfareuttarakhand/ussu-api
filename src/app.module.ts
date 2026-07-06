import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import configuration from "./config/configuration";
import { PrismaModule } from "./prisma/prisma.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { StudentsModule } from "./students/students.module";
import { StaffModule } from "./staff/staff.module";
import { AdmissionsModule } from "./admissions/admissions.module";
import { NoticesModule } from "./notices/notices.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? "development"}`, ".env"],
      load: [configuration],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    StudentsModule,
    StaffModule,
    AdmissionsModule,
    NoticesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
