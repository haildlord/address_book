import express, { Request, Response, NextFunction } from "express";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { AppError } from "../utils/AppError.js";
import { VerifyOwnershipBody } from "../interfaces/index.js";

const router = express.Router();

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  const { address, message, signature }: VerifyOwnershipBody = req.body;

  if (!address || !message || !signature) {
    return next(new AppError("missing fields or invalid inputs", 400));
  }

  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const addressBytes = bs58.decode(address);

    const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, addressBytes);

    return res.status(200).json({ valid });
  } catch (err) {
    return next(new AppError("missing fields or invalid inputs", 400));
  }
});

export default router;


