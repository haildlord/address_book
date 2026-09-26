import { Hono } from "hono";
import { PublicKey } from "@solana/web3.js";
import { AppError } from "../utility/AppError";
import { parsePublicKey } from "../lib/solana";
import { readJson } from "../lib/http";
import type { DerivePdaBody } from "../types";

const pda = new Hono<{ Bindings: Env }>();

// POST /api/derive-pda — { programId, seeds: string[] } -> { pda, bump }
pda.post("/", async (c) => {
  const { programId, seeds } = await readJson<DerivePdaBody>(c);

  if (!Array.isArray(seeds)) throw new AppError("missing seeds", 400);
  const program = parsePublicKey(programId);
  if (!program) throw new AppError("invalid programId", 400);

  const encoder = new TextEncoder();
  const seedBytes: Uint8Array[] = [];
  for (const seed of seeds) {
    if (typeof seed !== "string") throw new AppError("invalid seeds", 400);
    const bytes = encoder.encode(seed);
    if (bytes.length > 32) throw new AppError("any seed exceeds 32 bytes", 400);
    seedBytes.push(bytes);
  }
  if (seedBytes.length > 16) throw new AppError("too many seeds (max 16)", 400);

  try {
    const [address, bump] = PublicKey.findProgramAddressSync(seedBytes, program);
    return c.json({ pda: address.toBase58(), bump });
  } catch {
    throw new AppError("could not derive PDA", 400);
  }
});

export default pda;
