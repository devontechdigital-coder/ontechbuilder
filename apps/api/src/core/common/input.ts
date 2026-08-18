import { BadRequestException } from "@nestjs/common";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hostnamePattern = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${field} is required`);
  }

  return value.trim();
}

export function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return requiredString(value, field);
}

export function requiredSlug(value: unknown, field = "slug"): string {
  const slug = requiredString(value, field).toLowerCase();

  if (!slugPattern.test(slug)) {
    throw new BadRequestException(`${field} must be a lowercase URL-safe slug`);
  }

  return slug;
}

export function requiredHostname(value: unknown): string {
  const hostname = requiredString(value, "hostname").toLowerCase();

  if (!hostnamePattern.test(hostname)) {
    throw new BadRequestException("hostname must be a valid domain name");
  }

  return hostname;
}

export function optionalPositiveInteger(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }

  return value;
}
