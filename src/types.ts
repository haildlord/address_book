export type AddressType = "wallet" | "pda";

export interface ContactRow {
  id: number;
  name: string;
  address: string;
  type: AddressType;
  created_at: string;
}

export interface Contact {
  id: number;
  name: string;
  address: string;
  type: AddressType;
  createdAt: string;
}

export interface CreateContactBody {
  name: string;
  address: string;
}

export interface VerifyOwnershipBody {
  address: string;
  message: string;
  signature: string;
}

export interface DerivePdaBody {
  programId: string;
  seeds: string[];
}

export interface DeriveAtaBody {
  mintAddress: string;
  tokenProgram?: "token" | "token-2022";
}
