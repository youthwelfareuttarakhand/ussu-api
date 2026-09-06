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
import { PaymentsModule } from "./payments/payments.module";
import { ReferenceModule } from "./reference/reference.module";
import { ApplicationsModule } from "./applications/applications.module";
import { UkssuModule } from "./ukssu/ukssu.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { ContactModule } from "./contact/contact.module";
import { FeesModule } from "./fees/fees.module";

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
    PaymentsModule,
    ReferenceModule,
    ApplicationsModule,
    UkssuModule,
    AnalyticsModule,
    ContactModule,
    FeesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
