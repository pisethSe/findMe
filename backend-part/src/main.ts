import "reflect-metadata";

import {
  BadRequestException,
  ValidationPipe,
  type ValidationError,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module.js";
import { ApiExceptionFilter } from "./common/http/api-exception.filter.js";
import { MetricsService } from "./common/observability/metrics.service.js";
import { requestContextMiddleware } from "./common/observability/request-context.middleware.js";
import { requestLogMiddleware } from "./common/observability/request-log.middleware.js";
import { createRequestMetricsMiddleware } from "./common/observability/request-metrics.middleware.js";
import {
  getWebOrigin,
  getTrustedProxyCidrs,
  parseApiPort,
  validateApplicationEnvironment,
} from "./config/environment.js";

function flattenValidationErrors(
  errors: ValidationError[],
  parent = "",
): Array<{ field: string; message: string }> {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const ownErrors = Object.values(error.constraints ?? {}).map((message) => ({
      field,
      message,
    }));
    return [
      ...ownErrors,
      ...flattenValidationErrors(error.children ?? [], field),
    ];
  });
}

async function bootstrap(): Promise<void> {
  validateApplicationEnvironment();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const port = parseApiPort(process.env.PORT);
  const trustedProxies = getTrustedProxyCidrs(process.env.TRUSTED_PROXY_CIDRS);
  app.set("trust proxy", trustedProxies.length ? trustedProxies : false);

  // Correlation id and one JSON request log line before routing, so success
  // responses, guard rejections and errors all share the same id.
  app.use(requestContextMiddleware);
  app.use(requestLogMiddleware);
  app.use(createRequestMetricsMiddleware(app.get(MetricsService)));

  app.enableShutdownHooks();
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: "VALIDATION_FAILED",
          message: "One or more request fields are invalid.",
          fields: flattenValidationErrors(errors),
        }),
    }),
  );
  app.enableCors({
    origin: getWebOrigin(process.env.WEB_ORIGIN),
    credentials: true,
    exposedHeaders: ["Retry-After", "x-request-id"],
  });

  await app.listen(port, "0.0.0.0");
}

await bootstrap();
