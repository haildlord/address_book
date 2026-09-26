# Address Book for Solana

A simple website and API for saving **Solana addresses** with names, like a phone contacts list, but for crypto.

**Live demo:** https://address-book.address-book.workers.dev

## What is this project?

On Solana, every wallet or account is identified by a long address like `GK8nnaKBfsD8v5WHUSvUnfkqPGGz9ZkWZAdVoDh1sGmh`. Nobody can remember these. This project lets you:

- **Save contacts:** give an address a name, such as "Treasury". The app also tells you whether it is a normal **wallet** or a **PDA** (a special account controlled by a program, not by a person).
- **Find token accounts:** for any contact, work out their **associated token account (ATA)** for a token such as USDC. This is where their tokens are stored.
- **Derive PDAs:** enter a program ID and some seed words, and get the PDA address and its bump number.
- **Verify ownership:** check that someone really controls an address. They sign a message with their wallet, and the app checks the signature.

Everything runs without a wallet or a connection to the Solana network. The app only does the maths.

## Built with

- [Hono](https://hono.dev): the backend web framework
- [Cloudflare Workers](https://workers.cloudflare.com) and [D1](https://developers.cloudflare.com/d1/): hosting and the SQLite database
- [Tailwind CSS](https://tailwindcss.com): the design
- `@solana/web3.js`, `tweetnacl` and `bs58`: the Solana maths

## Run it on your computer

You need **Node.js 22 or newer**. A free [Cloudflare account](https://dash.cloudflare.com/sign-up) is only needed for deploying, not for running locally.

```bash
# 1. Get the code and install dependencies
git clone <your-repo-url>
cd address-book
npm install

# 2. Create the local database table
npm run db:local

# 3. Start the app
npm run dev
```

Open http://localhost:8787 in your browser.

The local database lives in `.wrangler/`. It is separate from the live one, so you can experiment freely.

## Deploy it to Cloudflare (free)

```bash
# 1. Log in to Cloudflare
npx wrangler login

# 2. Create your own database, then copy the database_id it prints
npx wrangler d1 create database-address-book
```

Paste that `database_id` into `wrangler.jsonc`, under `d1_databases`. Then:

```bash
# 3. Create the table in the live database
npm run db:remote

# 4. Deploy
npm run deploy
```

The command prints your link, like `https://address-book.<your-name>.workers.dev`.

## API

All endpoints start with `/api` and use JSON.

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/health` | Check that the API is running |
| GET | `/api/contacts?type=wallet\|pda&q=text` | List contacts, with optional filter and search |
| POST | `/api/contacts` | Save a contact: `{ "name", "address" }` |
| GET | `/api/contacts/:id` | Get one contact |
| DELETE | `/api/contacts/:id` | Delete a contact |
| POST | `/api/contacts/:id/derive-ata` | Get the token account: `{ "mintAddress", "tokenProgram"? }` |
| POST | `/api/derive-pda` | Derive a PDA: `{ "programId", "seeds": [] }` |
| POST | `/api/verify-ownership` | Check a signature: `{ "address", "message", "signature" }` |

Example:

```bash
curl -X POST http://localhost:8787/api/contacts \
  -H "content-type: application/json" \
  -d '{"name":"Treasury","address":"GK8nnaKBfsD8v5WHUSvUnfkqPGGz9ZkWZAdVoDh1sGmh"}'
```

Errors always look like `{ "success": false, "message": "what went wrong" }`.

## Project layout

```
public/            The website (index.html and assets/app.js)
src/index.ts       Hono app: routes and error handling
src/routes/        contacts, verify and pda endpoints
src/lib/           Solana helpers and request helpers
src/styles.css     Tailwind source (built into public/assets/styles.css)
schema.sql         Database table definition
wrangler.jsonc     Cloudflare configuration
```

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Build the CSS and start the local server |
| `npm run css:watch` | Rebuild the CSS whenever you change styles |
| `npm run typecheck` | Check the TypeScript for errors |
| `npm run deploy` | Build and deploy to Cloudflare |

## Good to know

- The name of a contact can be up to 32 characters.
- Saving the same address twice is rejected.
- Anyone with the link can add or delete contacts in the demo. There are no user accounts yet, so don't store anything private.
