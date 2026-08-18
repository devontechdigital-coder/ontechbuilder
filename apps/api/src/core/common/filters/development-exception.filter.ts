import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class DevelopmentExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DevelopmentExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = error instanceof Error ? error.message : "Unknown server error";
    const stack = error instanceof Error ? error.stack : undefined;

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} failed: ${message}`, stack);
    }

    if (error instanceof HttpException) {
      response.status(status).json(error.getResponse());
      return;
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: "Internal Server Error",
    });
  }
}
