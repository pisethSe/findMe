import "reflect-metadata";

import {
  BadRequestException,
  ValidationPipe,
  type ValidationError,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { ApiExceptionFilter } from "./common/http/api-exception.filter.js";
import {
  getWebOrigin,
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
  const app = await NestFactory.create(AppModule);
  const port = parseApiPort(process.env.PORT);

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
  });

  await app.listen(port, "0.0.0.0");
}

await bootstrap();
