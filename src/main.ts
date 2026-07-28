import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  // rawBody: true — the Razorpay webhook needs the raw request bytes to
  // verify its HMAC signature; the normal JSON body parser still runs too.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: config.get<string[]>("corsOrigins"),
    credentials: true,
  });

  await app.listen(config.get<number>("port") ?? 4000);
}

bootstrap();
