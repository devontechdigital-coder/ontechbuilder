import { Inject, Injectable, Logger } from "@nestjs/common";
import { createTransport, type Transporter } from "nodemailer";
import { type AppConfig } from "../config/config.js";
import { APP_CONFIG } from "../config/config.provider.js";

export interface SendMailInput {
  to: string;
  from?: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
}

export interface SendMailResult {
  sent: boolean;
  error?: string;
}

/**
 * Thin nodemailer wrapper, deliberately tolerant of missing configuration: this app shipped with
 * no SMTP setup at all, so every caller (form submission notifications, and anything future) needs
 * to keep working — storing what it tried to send and why delivery didn't happen — rather than
 * throwing whenever an operator hasn't set SMTP_HOST yet.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter | null;
  private readonly defaultFrom: string | undefined;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.defaultFrom = config.SMTP_FROM;
    this.transporter = config.SMTP_HOST
      ? createTransport({
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          secure: config.SMTP_SECURE,
          auth: config.SMTP_USER && config.SMTP_PASS ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
        })
      : null;
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  async send(input: SendMailInput): Promise<SendMailResult> {
    if (!this.transporter) {
      return { sent: false, error: "SMTP is not configured (set SMTP_HOST to enable email delivery)" };
    }

    try {
      await this.transporter.sendMail({
        to: input.to,
        from: input.from || this.defaultFrom || input.to,
        subject: input.subject,
        html: input.html,
        headers: input.headers,
      });
      return { sent: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown mail error";
      this.logger.error(`Failed to send email: ${message}`);
      return { sent: false, error: message };
    }
  }
}
