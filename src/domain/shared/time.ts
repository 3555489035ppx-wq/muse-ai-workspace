import { DomainError } from "../errors/domainError.js";

declare const isoTimestampBrand: unique symbol;

export type IsoTimestamp = string & { readonly [isoTimestampBrand]: true };

export interface EntityTimestamps {
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isIsoTimestamp(value: unknown): value is IsoTimestamp {
  if (typeof value !== "string" || !ISO_UTC_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

export function requireIsoTimestamp(value: unknown): IsoTimestamp {
  if (!isIsoTimestamp(value)) {
    throw new DomainError(
      "INVALID_ISO_TIMESTAMP",
      "Timestamp must be a canonical UTC ISO-8601 string.",
      { value },
    );
  }
  return value;
}

export function toIsoTimestamp(value: Date): IsoTimestamp {
  return requireIsoTimestamp(value.toISOString());
}

export function createTimestamps(now: Date = new Date()): EntityTimestamps {
  const timestamp = toIsoTimestamp(now);
  return { createdAt: timestamp, updatedAt: timestamp };
}

export function touchTimestamps(
  current: EntityTimestamps,
  now: Date = new Date(),
): EntityTimestamps {
  return {
    createdAt: current.createdAt,
    updatedAt: toIsoTimestamp(now),
  };
}
