import express, { Request, Response, NextFunction } from "express";
import { PublicKey } from "@solana/web3.js";
import { AppError } from "../utils/AppError.js";
import { DerivePdaBody } from "../interfaces/index.js";

const router = express.Router();

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  const { programId, seeds }: DerivePdaBody = req.body;

  // 1. Missing seeds validation
  if (!seeds || !Array.isArray(seeds)) {
    return next(new AppError("missing seeds", 400));
  }

  // 2. Invalid or missing programId validation
  if (!programId || typeof programId !== "string") {
    return next(new AppError("invalid programId", 400));
  }

  let programPublicKey: PublicKey;
  try {
    programPublicKey = new PublicKey(programId);
  } catch {
    return next(new AppError("invalid programId", 400));
  }

  // 3. Convert seeds to UTF-8 Buffers and ensure none exceeds 32 bytes
  const seedBuffers: Buffer[] = [];
  for (const seed of seeds) {
    if (typeof seed !== "string") {
      return next(new AppError("invalid seeds", 400));
    }

    const seedBuffer = Buffer.from(seed, "utf-8");
    if (seedBuffer.length > 32) {
      return next(new AppError("any seed exceeds 32 bytes", 400));
    }

    seedBuffers.push(seedBuffer);
  }

  try {
    // 4. Derive PDA and bump
    const [pda, bump] = PublicKey.findProgramAddressSync(seedBuffers, programPublicKey);

    return res.status(200).json({
      pda: pda.toBase58(),
      bump,
    });
  } catch (err) {
    return next(new AppError("could not derive PDA", 400));
  }
});

export default router;
