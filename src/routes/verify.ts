import { Hono } from "hono";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { AppError } from "../utility/AppError";
import { readJson } from "../lib/http";
import type { VerifyOwnershipBody } from "../types";

const verify = new Hono<{ Bindings: Env }>();

// POST /api/verify-ownership — verifies an ed25519 signature (base58) of a UTF-8 message
verify.post("/", async (c) => {
  const { address, message, signature } = await readJson<VerifyOwnershipBody>(c);

  if (typeof address !== "string" || typeof message !== "string" || typeof signature !== "string" || !address || !message || !signature) {
    throw new AppError("missing fields or invalid inputs", 400);
  }

  try {
    const addressBytes = bs58.decode(address);
    const signatureBytes = bs58.decode(signature);
    if (addressBytes.length !== 32 || signatureBytes.length !== 64) throw new Error("bad length");

    const valid = nacl.sign.detached.verify(new TextEncoder().encode(message), signatureBytes, addressBytes);
    return c.json({ valid });
  } catch {
    throw new AppError("missing fields or invalid inputs", 400);
  }
});

export default verify;
