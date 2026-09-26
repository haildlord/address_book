import { Hono } from "hono";
import { PublicKey } from "@solana/web3.js";
import { AppError } from "../utility/AppError";
import { deriveAta, parsePublicKey, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "../lib/solana";
import { parseId, readJson } from "../lib/http";
import type { AddressType, Contact, ContactRow, CreateContactBody, DeriveAtaBody } from "../types";

const MAX_NAME_LENGTH = 32;
// Public demo: cap the table size so it can't be filled with junk.
const MAX_CONTACTS = 200;

const toContact = (row: ContactRow): Contact => ({
  id: row.id,
  name: row.name,
  address: row.address,
  type: row.type,
  createdAt: row.created_at,
});

const contacts = new Hono<{ Bindings: Env }>();

// POST /api/contacts — save an address; wallet vs PDA is detected via the ed25519 curve check
contacts.post("/", async (c) => {
  const body = await readJson<CreateContactBody>(c);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";

  if (!name || !address) throw new AppError("missing or invalid fields", 400);
  if (name.length > MAX_NAME_LENGTH) throw new AppError(`name must be at most ${MAX_NAME_LENGTH} characters`, 400);

  const key = parsePublicKey(address);
  if (!key) throw new AppError("address is not a valid Solana public key", 400);

  const existing = await c.env.DB.prepare("SELECT id FROM user_address_book WHERE address = ?").bind(address).first();
  if (existing) throw new AppError("address already exists", 409);

  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM user_address_book").first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_CONTACTS) throw new AppError(`Contact limit reached (${MAX_CONTACTS})`, 429);

  const type: AddressType = PublicKey.isOnCurve(key.toBytes()) ? "wallet" : "pda";
  const row = await c.env.DB.prepare("INSERT INTO user_address_book (name, address, type) VALUES (?, ?, ?) RETURNING *")
    .bind(name, address, type)
    .first<ContactRow>();

  if (!row) throw new AppError("could not save contact", 500);
  return c.json(toContact(row), 201);
});

// GET /api/contacts?type=wallet|pda&q=search
contacts.get("/", async (c) => {
  const type = c.req.query("type");
  const q = c.req.query("q")?.trim().slice(0, 64);

  if (type && type !== "wallet" && type !== "pda") throw new AppError("type must be 'wallet' or 'pda'", 400);

  const where: string[] = [];
  const params: string[] = [];
  if (type) {
    where.push("type = ?");
    params.push(type);
  }
  if (q) {
    where.push("(name LIKE ? ESCAPE '\\' OR address LIKE ? ESCAPE '\\')");
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    params.push(like, like);
  }

  const sql = `SELECT * FROM user_address_book${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC`;
  const { results } = await c.env.DB.prepare(sql)
    .bind(...params)
    .all<ContactRow>();

  return c.json({ contacts: results.map(toContact) });
});

// GET /api/contacts/:id
contacts.get("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  const row = await c.env.DB.prepare("SELECT * FROM user_address_book WHERE id = ?").bind(id).first<ContactRow>();
  if (!row) throw new AppError("Contact not found", 404);
  return c.json({ contact: toContact(row) });
});

// PATCH /api/contacts/:id — rename and/or change the address (type is re-detected)
contacts.patch("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  const body = await readJson<Partial<CreateContactBody>>(c);

  const current = await c.env.DB.prepare("SELECT * FROM user_address_book WHERE id = ?").bind(id).first<ContactRow>();
  if (!current) throw new AppError("Contact not found", 404);

  let name = current.name;
  if (body.name !== undefined) {
    name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new AppError("name cannot be empty", 400);
    if (name.length > MAX_NAME_LENGTH) throw new AppError(`name must be at most ${MAX_NAME_LENGTH} characters`, 400);
  }

  let address = current.address;
  let type = current.type;
  if (body.address !== undefined) {
    address = typeof body.address === "string" ? body.address.trim() : "";
    const key = parsePublicKey(address);
    if (!key) throw new AppError("address is not a valid Solana public key", 400);
    if (address !== current.address) {
      const dup = await c.env.DB.prepare("SELECT id FROM user_address_book WHERE address = ? AND id != ?").bind(address, id).first();
      if (dup) throw new AppError("address already exists", 409);
      type = PublicKey.isOnCurve(key.toBytes()) ? "wallet" : "pda";
    }
  }

  if (body.name === undefined && body.address === undefined) throw new AppError("nothing to update", 400);

  const row = await c.env.DB.prepare("UPDATE user_address_book SET name = ?, address = ?, type = ? WHERE id = ? RETURNING *")
    .bind(name, address, type, id)
    .first<ContactRow>();
  if (!row) throw new AppError("Contact not found", 404);
  return c.json(toContact(row));
});

// DELETE /api/contacts/:id
contacts.delete("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  const res = await c.env.DB.prepare("DELETE FROM user_address_book WHERE id = ?").bind(id).run();
  if (!res.meta.changes) throw new AppError("Contact not found", 404);
  return c.json({ message: "Contact deleted" });
});

// POST /api/contacts/:id/derive-ata — associated token account of the contact for a given mint
contacts.post("/:id/derive-ata", async (c) => {
  const id = parseId(c.req.param("id"));
  const body = await readJson<DeriveAtaBody>(c);

  const mint = parsePublicKey(body.mintAddress);
  if (!mint) throw new AppError("Invalid mint address", 400);
  if (body.tokenProgram !== undefined && body.tokenProgram !== "token" && body.tokenProgram !== "token-2022") {
    throw new AppError("tokenProgram must be 'token' or 'token-2022'", 400);
  }

  const row = await c.env.DB.prepare("SELECT address FROM user_address_book WHERE id = ?")
    .bind(id)
    .first<{ address: string }>();
  if (!row) throw new AppError("Contact not found", 404);

  const program = body.tokenProgram === "token-2022" ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const [ata, bump] = deriveAta(new PublicKey(row.address), mint, program);

  return c.json({ ata: ata.toBase58(), bump, owner: row.address, mint: mint.toBase58(), tokenProgram: program.toBase58() });
});

export default contacts;
