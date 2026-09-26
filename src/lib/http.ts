import type { Context } from "hono";
import { AppError } from "../utility/AppError";

/** Reads a JSON object body, turning malformed / non-object payloads into a 400. */
export async function readJson<T>(c: Context): Promise<Partial<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new AppError("Malformed JSON payload", 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError("Request body must be a JSON object", 400);
  }
  return body as Partial<T>;
}

/** Parses a positive integer route id. */
export function parseId(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw) || Number(raw) < 1) throw new AppError("Invalid contact id", 400);
  return Number(raw);
}
