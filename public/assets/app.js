// AddressBook frontend — vanilla ES module, talks to the Hono API under /api.
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = { filter: "", query: "", contacts: [], allContacts: [], ataContact: null };

// ---------- helpers ----------
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const short = (a, n = 6) => (a.length > n * 2 + 3 ? `${a.slice(0, n)}…${a.slice(-n)}` : a);
const timeAgo = (iso) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const units = [["d", 86400], ["h", 3600], ["m", 60]];
  for (const [u, sec] of units) if (s >= sec) return `${Math.floor(s / sec)}${u} ago`;
};
const ICON = {
  copy: '<path d="M8 8h11v11H8z"/><path d="M5 16V5h11"/>',
  check: '<path d="m5 13 4 4L19 7"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h4.5a1.5 1.5 0 0 1 0 3H9"/>',
};
const icon = (name, cls = "size-4") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Network error — is the API reachable?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

function toast(message, kind = "success") {
  const colors = {
    success: "border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
    error: "border-rose-500/30 text-rose-700 dark:text-rose-300",
  };
  const el = document.createElement("div");
  el.className = `animate-pop pointer-events-auto flex items-center gap-2.5 rounded-xl border bg-white px-4 py-3 text-sm font-medium shadow-xl dark:bg-[#161624] ${colors[kind]}`;
  el.innerHTML = `<span class="size-2 shrink-0 rounded-full ${kind === "success" ? "bg-emerald-500" : "bg-rose-500"}"></span><span>${esc(message)}</span>`;
  $("#toasts").append(el);
  setTimeout(() => el.remove(), 3800);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  } catch {
    toast("Could not copy", "error");
  }
}

function showError(id, msg) {
  const el = $(id);
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
}

function setBusy(btn, busy, label) {
  if (busy) btn.dataset.label = btn.textContent;
  btn.disabled = busy;
  btn.textContent = busy ? label : btn.dataset.label;
}

const explorer = (addr) => `https://explorer.solana.com/address/${addr}`;

// ---------- theme ----------
$("#theme-toggle").addEventListener("click", () => {
  const dark = document.documentElement.classList.toggle("dark");
  try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
});
$("#year").textContent = new Date().getFullYear();
$("#api-base").textContent = `${location.origin}/api`;

// ---------- API status ----------
async function checkHealth() {
  const box = $("#api-status");
  const dot = $("#api-dot");
  const ping = $("#api-dot-ping");
  try {
    await api("/health");
    box.className = "inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400";
    dot.className = "relative inline-flex size-2 rounded-full bg-emerald-500";
    ping.className = "absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75";
    $("#api-status-text").textContent = "API online";
  } catch {
    box.className = "inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600";
    dot.className = "relative inline-flex size-2 rounded-full bg-rose-500";
    $("#api-status-text").textContent = "API offline";
  }
}

// ---------- tabs ----------
function selectTab(name) {
  $$("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
  $$("[data-panel]").forEach((p) => p.classList.toggle("hidden", p.id !== `panel-${name}`));
}
$$("[data-tab]").forEach((b) => b.addEventListener("click", () => selectTab(b.dataset.tab)));

// ---------- contacts ----------
function renderStats() {
  const all = state.allContacts;
  $("#stat-total").textContent = all.length;
  $("#stat-wallet").textContent = all.filter((c) => c.type === "wallet").length;
  $("#stat-pda").textContent = all.filter((c) => c.type === "pda").length;
}

function skeleton() {
  return Array.from({ length: 3 }, () =>
    `<li class="flex animate-pulse items-center gap-4 p-4 sm:p-5"><div class="size-10 rounded-xl bg-slate-200 dark:bg-white/10"></div><div class="flex-1 space-y-2"><div class="h-3.5 w-1/4 rounded bg-slate-200 dark:bg-white/10"></div><div class="h-3 w-2/3 rounded bg-slate-200 dark:bg-white/10"></div></div></li>`).join("");
}

function contactRow(c) {
  const wallet = c.type === "wallet";
  const badge = wallet
    ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300"
    : "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300";
  const initial = esc(c.name.trim().charAt(0).toUpperCase() || "?");
  return `
  <li class="animate-fade-up group flex flex-col gap-3 p-4 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:gap-4 sm:p-5 dark:hover:bg-white/[0.02]" data-id="${c.id}">
    <div class="flex min-w-0 flex-1 items-center gap-4">
      <div class="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${wallet ? "from-emerald-500 to-teal-600" : "from-amber-500 to-orange-600"} text-sm font-bold text-white shadow">${initial}</div>
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <span class="truncate font-semibold text-slate-900 dark:text-white">${esc(c.name)}</span>
          <span class="badge ${badge}">${wallet ? "Wallet" : "PDA"}</span>
        </div>
        <p class="mt-0.5 truncate font-mono text-xs text-slate-500 dark:text-slate-400" title="${esc(c.address)}">
          <span class="sm:hidden">${esc(short(c.address, 8))}</span><span class="hidden sm:inline">${esc(c.address)}</span>
        </p>
        <p class="mt-0.5 text-xs text-slate-400">Added ${timeAgo(c.createdAt)}</p>
      </div>
    </div>
    <div class="flex items-center gap-1 self-end sm:self-auto">
      <button class="icon-btn" data-action="copy" title="Copy address">${icon("copy")}</button>
      <a class="icon-btn" href="${explorer(c.address)}" target="_blank" rel="noopener noreferrer" title="View on Solana Explorer">${icon("external")}</a>
      <button class="btn-ghost !px-3 !py-1.5 text-xs" data-action="ata" title="Derive associated token account">${icon("coin", "size-3.5")} Derive ATA</button>
      <button class="icon-btn hover:!bg-rose-500/10 hover:!text-rose-500" data-action="delete" title="Delete">${icon("trash")}</button>
    </div>
  </li>`;
}

function renderContacts() {
  const list = $("#contact-list");
  if (!state.contacts.length) {
    const filtered = state.query || state.filter;
    list.innerHTML = `<li class="px-6 py-16 text-center">
      <div class="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500"><svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg></div>
      <p class="font-semibold text-slate-900 dark:text-white">${filtered ? "No matching contacts" : "No contacts yet"}</p>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">${filtered ? "Try a different search or filter." : "Add your first Solana address using the form."}</p></li>`;
    return;
  }
  list.innerHTML = state.contacts.map(contactRow).join("");
}

async function loadContacts({ initial = false } = {}) {
  if (initial) $("#contact-list").innerHTML = skeleton();
  const params = new URLSearchParams();
  if (state.filter) params.set("type", state.filter);
  if (state.query) params.set("q", state.query);
  try {
    const qs = params.toString();
    const { contacts } = await api(`/contacts${qs ? `?${qs}` : ""}`);
    state.contacts = contacts;
    if (!state.filter && !state.query) state.allContacts = contacts;
    else state.allContacts = (await api("/contacts")).contacts;
    renderStats();
    renderContacts();
  } catch (e) {
    $("#contact-list").innerHTML = `<li class="px-6 py-14 text-center text-sm text-rose-500">${esc(e.message)}</li>`;
  }
}

$("#add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#add-submit");
  const name = $("#add-name").value.trim();
  const address = $("#add-address").value.trim();
  showError("#add-error", "");
  if (!name || !address) return showError("#add-error", "Please enter both a name and an address.");
  setBusy(btn, true, "Saving…");
  try {
    const c = await api("/contacts", { method: "POST", body: { name, address } });
    e.target.reset();
    toast(`Saved “${c.name}” as a ${c.type === "wallet" ? "wallet" : "PDA"}`);
    await loadContacts();
  } catch (err) {
    showError("#add-error", err.message);
  } finally {
    setBusy(btn, false);
  }
});

$("#add-sample").addEventListener("click", () => {
  const samples = [
    ["Solana Foundation", "GK8nnaKBfsD8v5WHUSvUnfkqPGGz9ZkWZAdVoDh1sGmh"],
    ["Sample PDA", "Fs17nH3wHgZk1PthqYMCdzpXguTerNnc8EM1Z5m4ZQ3J"],
    ["Foundation USDC ATA", "5uXHDcwrwoEY6Yt5Jpi3pJvZakydQDwvJyqERAuKBpth"],
    ["USDC Mint Authority", "BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG"],
  ];
  const [n, a] = samples[Math.floor(Math.random() * samples.length)];
  $("#add-name").value = n.slice(0, 32);
  $("#add-address").value = a;
});

let searchTimer;
$("#search").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.query = e.target.value.trim(); loadContacts(); }, 250);
});

$("#filters").addEventListener("click", (e) => {
  const b = e.target.closest("[data-filter]");
  if (!b) return;
  state.filter = b.dataset.filter;
  $$("[data-filter]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  loadContacts();
});

$("#contact-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const li = btn.closest("li[data-id]");
  const contact = state.contacts.find((c) => c.id === Number(li.dataset.id));
  if (!contact) return;

  if (btn.dataset.action === "copy") return copy(contact.address);
  if (btn.dataset.action === "ata") return openAta(contact);
  if (btn.dataset.action === "delete") {
    if (!confirm(`Delete “${contact.name}”? This can't be undone.`)) return;
    try {
      await api(`/contacts/${contact.id}`, { method: "DELETE" });
      toast("Contact deleted");
      await loadContacts();
    } catch (err) {
      toast(err.message, "error");
    }
  }
});

// ---------- ATA modal ----------
const modal = $("#ata-modal");
function openAta(contact) {
  state.ataContact = contact;
  $("#ata-owner").textContent = `${contact.name} · ${short(contact.address, 6)}`;
  $("#ata-result").classList.add("hidden");
  showError("#ata-error", "");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  $("#ata-mint").focus();
}
function closeAta() {
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}
$("#ata-close").addEventListener("click", closeAta);
modal.addEventListener("click", (e) => { if (e.target === modal) closeAta(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAta(); });
$$("[data-mint]", modal).forEach((b) => b.addEventListener("click", () => { $("#ata-mint").value = b.dataset.mint; }));

function resultRow(label, value, { link = false } = {}) {
  return `<div class="flex items-center justify-between gap-3 py-1.5">
    <div class="min-w-0"><p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">${esc(label)}</p>
    <p class="break-all font-mono text-sm text-slate-900 dark:text-white">${esc(value)}</p></div>
    ${link ? `<button class="icon-btn shrink-0" data-copy="${esc(value)}" title="Copy">${icon("copy")}</button>` : ""}</div>`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-copy]");
  if (b) copy(b.dataset.copy);
});

$("#ata-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.submitter || $("button[type=submit]", e.target);
  showError("#ata-error", "");
  $("#ata-result").classList.add("hidden");
  setBusy(btn, true, "Deriving…");
  try {
    const r = await api(`/contacts/${state.ataContact.id}/derive-ata`, {
      method: "POST",
      body: { mintAddress: $("#ata-mint").value.trim(), tokenProgram: $("#ata-program").value },
    });
    const out = $("#ata-result");
    out.innerHTML = resultRow("Associated token account", r.ata, { link: true }) + resultRow("Bump", String(r.bump));
    out.classList.remove("hidden");
  } catch (err) {
    showError("#ata-error", err.message);
  } finally {
    setBusy(btn, false);
  }
});

// ---------- PDA ----------
function addSeed(value = "") {
  const row = document.createElement("div");
  row.className = "flex gap-2";
  row.innerHTML = `<input class="input font-mono" data-seed placeholder="seed (utf-8)" autocomplete="off" spellcheck="false" value="${esc(value)}" />
    <button type="button" class="icon-btn size-10 shrink-0 border border-slate-200 dark:border-white/10" aria-label="Remove seed">${icon("trash")}</button>`;
  $("button", row).addEventListener("click", () => row.remove());
  $("#seed-list").append(row);
}
addSeed("metadata");
$("#seed-add").addEventListener("click", () => addSeed());

$("#pda-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("button[type=submit]", e.target);
  showError("#pda-error", "");
  const seeds = $$("[data-seed]").map((i) => i.value);
  setBusy(btn, true, "Deriving…");
  try {
    const r = await api("/derive-pda", { method: "POST", body: { programId: $("#pda-program").value.trim(), seeds } });
    const out = $("#pda-result");
    out.className = "mt-4 flex-1 text-left";
    out.innerHTML = `<div class="rounded-xl border border-brand-500/30 bg-brand-500/10 p-4">${resultRow("PDA", r.pda, { link: true })}${resultRow("Canonical bump", String(r.bump))}</div>
      <a class="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300" href="${explorer(r.pda)}" target="_blank" rel="noopener noreferrer">View on Explorer ${icon("external", "size-3.5")}</a>`;
  } catch (err) {
    showError("#pda-error", err.message);
  } finally {
    setBusy(btn, false);
  }
});

// ---------- Verify ----------
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Encode(bytes) {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  return "1".repeat(zeros) + digits.reverse().map((d) => B58[d]).join("");
}

function renderVerify(valid) {
  const out = $("#verify-result");
  out.className = "mt-4 flex flex-1 items-center justify-center text-center";
  out.innerHTML = valid
    ? `<div class="animate-pop"><div class="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-500"><svg class="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg></div>
        <p class="text-lg font-bold text-emerald-600 dark:text-emerald-400">Signature valid</p><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">This address signed the message.</p></div>`
    : `<div class="animate-pop"><div class="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-rose-500/15 text-rose-500"><svg class="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></div>
        <p class="text-lg font-bold text-rose-600 dark:text-rose-400">Signature invalid</p><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">The signature does not match this address and message.</p></div>`;
}

async function verify() {
  const btn = $("button[type=submit]", $("#verify-form"));
  showError("#verify-error", "");
  setBusy(btn, true, "Verifying…");
  try {
    const r = await api("/verify-ownership", {
      method: "POST",
      body: { address: $("#v-address").value.trim(), message: $("#v-message").value, signature: $("#v-signature").value.trim() },
    });
    renderVerify(r.valid);
  } catch (err) {
    showError("#verify-error", err.message);
  } finally {
    setBusy(btn, false);
  }
}
$("#verify-form").addEventListener("submit", (e) => { e.preventDefault(); verify(); });

$("#phantom-sign").addEventListener("click", async () => {
  const provider = window.phantom?.solana ?? window.solflare ?? window.solana;
  if (!provider) return toast("No Solana wallet found — install Phantom or Solflare.", "error");
  try {
    const { publicKey } = await provider.connect();
    const message = $("#v-message").value || "I own this address";
    const { signature } = await provider.signMessage(new TextEncoder().encode(message), "utf8");
    $("#v-address").value = publicKey.toString();
    $("#v-signature").value = base58Encode(signature);
    await verify();
  } catch (err) {
    toast(err?.message || "Signing was cancelled", "error");
  }
});

const EXAMPLE = {"address": "4VHEBdWerLvLuAMpmQ5Pcs1UpvMguXVDeMVyBknwcsoV", "message": "I own this address", "signature": "4p8vqBzZaUHiNykwe1ajzszZNgmrDrUKV9Yqaev5Tj89Uevb5S5Wp7DJPzjqYr4nNStwjJW1UXgFhuYX2qvvQpkk"};
function loadExample(tamper) {
  $("#v-address").value = EXAMPLE.address;
  $("#v-message").value = tamper ? EXAMPLE.message + "!" : EXAMPLE.message;
  $("#v-signature").value = EXAMPLE.signature;
  showError("#verify-error", "");
  toast(tamper ? "Tampered message loaded — verification should fail" : "Valid example loaded — click Verify");
}
$("#v-example").addEventListener("click", () => loadExample(false));
$("#v-tamper").addEventListener("click", () => loadExample(true));

// ---------- boot ----------
checkHealth();
loadContacts({ initial: true });
