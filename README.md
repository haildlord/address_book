# Address Book for Solana: Node.js + Express version

> This is the **Express + PostgreSQL** version of the project. The newer **Hono + Cloudflare Workers** version, with a full website, lives on the [`main` branch](https://github.com/haildlord/address_book).
>
> **Live demo of the Hono version:** https://address-book.address-book.workers.dev

A simple API for saving **Solana addresses** with names, like a phone contacts list, but for crypto.

## What is this project?

On Solana, every wallet or account is identified by a long address like `GK8nnaKBfsD8v5WHUSvUnfkqPGGz9ZkWZAdVoDh1sGmh`. Nobody can remember these. This API lets you:

- **Save contacts:** give an address a name. The API tells you whether it is a normal **wallet** or a **PDA** (a special account controlled by a program, not by a person).
- **Find token accounts:** for a contact, work out their **associated token account (ATA)** for a token such as USDC.
- **Verify ownership:** check that someone controls an address by checking a signature they made with their wallet.

It only does the maths, so it never connects to the Solana network.

## Built with

[Node.js](https://nodejs.org), [Express 5](https://expressjs.com), TypeScript, [PostgreSQL](https://www.postgresql.org) (`pg`), `@solana/web3.js`, `@solana/spl-token`, `tweetnacl`, `bs58`.

## Get the code

```bash
git clone -b express-node https://github.com/haildlord/address_book.git
cd address_book
```

## Run it on your computer

You need **Node.js 20.6 or newer** and **PostgreSQL** running locally.

```bash
# 1. Install dependencies
npm install

# 2. Create a database (the table is created automatically on start)
createdb address-book

# 3. Set up your settings
cp .env.example .env
# then open .env and enter your Postgres password

# 4. Start the server
npm run dev
```

The API runs at http://localhost:3000/api.

To build and run the compiled version:

```bash
npm run build
npm start
```

## API

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/contacts?type=wallet\|pda` | List contacts, with an optional filter |
| POST | `/api/contacts` | Save a contact: `{ "name", "address" }` |
| GET | `/api/contacts/:id` | Get one contact |
| DELETE | `/api/contacts/:id` | Delete a contact |
| POST | `/api/contacts/:id/derive-ata` | Get the token account: `{ "mintAddress" }` |
| POST | `/api/verify-ownership` | Check a signature: `{ "address", "message", "signature" }` (base58) |

Example:

```bash
curl -X POST http://localhost:3000/api/contacts \
  -H "content-type: application/json" \
  -d '{"name":"Treasury","address":"GK8nnaKBfsD8v5WHUSvUnfkqPGGz9ZkWZAdVoDh1sGmh"}'
```

Errors look like `{ "success": false, "message": "what went wrong" }`.

## Project layout

```
src/index.ts          Express app and server start
src/router/           contacts, verify-ownership and derivePDA routes
src/config/db.ts      PostgreSQL connection and table creation
src/middlewares/      Error handler
src/utils/AppError.ts Custom error class
```

## Good to know

- The `name` column allows up to 10 characters.
- `src/router/derivePDA.ts` exists but is not yet connected to the router. The Hono version on `main` connects it as `/api/derive-pda`.

## Security

- Your database password is read from `.env`, which is git-ignored. Never commit it.
- All database queries are parameterised.
