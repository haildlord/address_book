// AddressBook frontend — vanilla ES module, talks to the Hono API under /api.
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// If anything crashes, tell the user instead of silently doing nothing.
function fatal() {
  const el = document.getElementById("fatal");
  if (el) el.classList.remove("hidden");
}
window.addEventListener("error", fatal);
window.addEventListener("unhandledrejection", (e) => console.error(e.reason));

const state = { filter: "", query: "", contacts: [], allContacts: [], ataContact: null, editing: null, deleting: null };

const SAMPLES = [
  ["Solana Foundation", "GK8nnaKBfsD8v5WHUSvUnfkqPGGz9ZkWZAdVoDh1sGmh"],
  ["Sample PDA", "Fs17nH3wHgZk1PthqYMCdzpXguTerNnc8EM1Z5m4ZQ3J"],
  ["Foundation USDC ATA", "5uXHDcwrwoEY6Yt5Jpi3pJvZakydQDwvJyqERAuKBpth"],
  ["USDC Mint Authority", "BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG"],
];
const EXAMPLE_SIG = {"address": "4VHEBdWerLvLuAMpmQ5Pcs1UpvMguXVDeMVyBknwcsoV", "message": "I own this address", "signature": "4p8vqBzZaUHiNykwe1ajzszZNgmrDrUKV9Yqaev5Tj89Uevb5S5Wp7DJPzjqYr4nNStwjJW1UXgFhuYX2qvvQpkk"};

// ---------- helpers ----------
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const short = (a, n = 6) => (a.length > n * 2 + 3 ? `${a.slice(0, n)}…${a.slice(-n)}` : a);
const timeAgo = (iso) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const units = [["d", 86400], ["h", 3600], ["m", 60]];
  for (const [u, sec] of units) if (s >= sec) return `${Math.floor(s / sec)}${u} ago`;
  return "just now";
};
const ICON = {
  copy: '<path d="M8 8h11v11H8z"/><path d="M5 16V5h11"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h4.5a1.5 1.5 0 0 1 0 3H9"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
};
const icon = (name, cls = "size-4") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
const explorer = (addr) => `https://explorer.solana.com/address/${addr}`;

async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Could not reach the server. Check your internet connection and try again.");
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
  setTimeout(() => el.remove(), 4200);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  } catch {
    toast("Could not copy — select the text and copy it manually.", "error");
  }
}

function showError(sel, msg) {
  const el = $(sel);
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
}

function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.textContent;
    btn.textContent = label;
  } else if (btn.dataset.label) {
    btn.textContent = btn.dataset.label;
  }
  btn.disabled = busy;
}

// ---------- theme / footer ----------
$("#theme-toggle").addEventListener("click", () => {
  const dark = document.documentElement.classList.toggle("dark");
  try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
});
$("#year").textContent = new Date().getFullYear();
$("#api-base").textContent = `${location.origin}/api`;

async function checkHealth() {
  const box = $("#api-status");
  const dot = $("#api-dot");
  const ping = $("#api-dot-ping");
  const label = $("#api-status-text");
  try {
    await api("/health");
    box.className = "hidden sm:inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400";
    dot.className = "relative inline-flex size-2 rounded-full bg-emerald-500";
    ping.className = "absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75";
    label.textContent = "API online";
  } catch {
    box.className = "hidden sm:inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600";
    dot.className = "relative inline-flex size-2 rounded-full bg-rose-500";
    label.textContent = "API offline";
  }
}

// ---------- tabs & navigation ----------
const TABS = ["contacts", "pda", "verify"];
function selectTab(name) {
  $$("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
  $$("[data-panel]").forEach((p) => p.classList.toggle("hidden", p.id !== `panel-${name}`));
}
function goto(name) {
  selectTab(name);
  $("#app").scrollIntoView({ behavior: "smooth", block: "start" });
}
$$("[data-tab]").forEach((b) => b.addEventListener("click", () => selectTab(b.dataset.tab)));
$$("[data-goto]").forEach((el) =>
  el.addEventListener("click", (e) => {
    e.preventDefault();
    goto(el.dataset.goto);
  }),
);
function fromHash() {
  const name = location.hash.slice(1);
  if (TABS.includes(name)) goto(name);
}
window.addEventListener("hashchange", fromHash);

// ---------- contacts ----------
function renderStats() {
  const all = state.allContacts;
  $("#stat-total").textContent = all.length;
  $("#stat-wallet").textContent = all.filter((c) => c.type === "wallet").length;
  $("#stat-pda").textContent = all.filter((c) => c.type === "pda").length;
  renderContactPicker();
}

function renderContactPicker() {
  const sel = $("#v-contact");
  const wallets = state.allContacts.filter((c) => c.type === "wallet");
  if (!wallets.length) return sel.classList.add("hidden");
  sel.innerHTML = `<option value="">…or pick one of your saved wallets</option>` +
    wallets.map((c) => `<option value="${esc(c.address)}">${esc(c.name)} — ${esc(short(c.address, 6))}</option>`).join("");
  sel.classList.remove("hidden");
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
  const tip = wallet ? "A normal wallet controlled by a private key" : "A Program Derived Address (controlled by a program)";
  const initial = esc(c.name.trim().charAt(0).toUpperCase() || "?");
  return `
  <li class="animate-fade-up flex flex-col gap-3 p-4 transition hover:bg-slate-50/70 sm:p-5 dark:hover:bg-white/[0.02]" data-id="${c.id}">
    <div class="flex min-w-0 items-center gap-4">
      <div class="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${wallet ? "from-emerald-500 to-teal-600" : "from-amber-500 to-orange-600"} text-sm font-bold text-white shadow">${initial}</div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="truncate font-semibold text-slate-900 dark:text-white">${esc(c.name)}</span>
          <span class="badge ${badge}" title="${tip}">${wallet ? "Wallet" : "PDA"}</span>
        </div>
        <p class="mt-0.5 break-all font-mono text-xs text-slate-500 dark:text-slate-400">${esc(c.address)}</p>
        <p class="mt-0.5 text-xs text-slate-400">Added ${timeAgo(c.createdAt)}</p>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2 sm:pl-14">
      <button type="button" class="btn-ghost !px-3 !py-1.5 text-xs" data-action="ata" title="Work out this contact's token account for a token like USDC">${icon("coin", "size-3.5")} Find token account</button>
      <button type="button" class="btn-ghost !px-3 !py-1.5 text-xs" data-action="edit">${icon("edit", "size-3.5")} Edit</button>
      <button type="button" class="btn-ghost !px-3 !py-1.5 text-xs" data-action="copy" title="Copy address">${icon("copy", "size-3.5")} Copy</button>
      <a class="btn-ghost !px-3 !py-1.5 text-xs" href="${explorer(c.address)}" target="_blank" rel="noopener noreferrer" title="Open in Solana Explorer">${icon("external", "size-3.5")} Explorer</a>
      <button type="button" class="btn-ghost !px-3 !py-1.5 text-xs !text-rose-600 hover:!bg-rose-500/10 dark:!text-rose-400" data-action="delete">${icon("trash", "size-3.5")} Delete</button>
    </div>
  </li>`;
}

function renderContacts() {
  const list = $("#contact-list");
  if (!state.contacts.length) {
    const filtered = state.query || state.filter;
    list.innerHTML = `<li class="px-6 py-14 text-center">
      <div class="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500"><svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg></div>
      <p class="font-semibold text-slate-900 dark:text-white">${filtered ? "No contacts match" : "Your address book is empty"}</p>
      <p class="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">${filtered ? "Try a different search word, or choose “All”." : "Add your first contact using the form, or load some examples to look around."}</p>
      ${filtered ? "" : `<button type="button" data-demo="samples" class="btn-primary mt-5">Add 3 sample contacts</button>`}</li>`;
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
    state.allContacts = qs ? (await api("/contacts")).contacts : contacts;
    renderStats();
    renderContacts();
  } catch (e) {
    $("#contact-list").innerHTML = `<li class="px-6 py-14 text-center text-sm text-rose-500">${esc(e.message)}<br><button type="button" id="retry-load" class="btn-ghost mt-4">Try again</button></li>`;
  }
}

$("#add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#add-submit");
  const name = $("#add-name").value.trim();
  const address = $("#add-address").value.trim();
  showError("#add-error", "");
  if (!name) return showError("#add-error", "Please type a name first.");
  if (!address) return showError("#add-error", "Please paste a Solana address.");
  setBusy(btn, true, "Saving…");
  try {
    const c = await api("/contacts", { method: "POST", body: { name, address } });
    $("#add-form").reset();
    toast(`Saved “${c.name}” as a ${c.type === "wallet" ? "wallet" : "PDA"}`);
    await loadContacts();
  } catch (err) {
    showError("#add-error", err.message);
  } finally {
    setBusy(btn, false);
  }
});

let sampleIdx = 0;
$("#add-sample").addEventListener("click", () => {
  const [n, a] = SAMPLES[sampleIdx++ % SAMPLES.length];
  $("#add-name").value = n;
  $("#add-address").value = a;
  showError("#add-error", "");
  toast("Example filled in — now press “Save contact”");
});

async function addSamples(btn) {
  setBusy(btn, true, "Adding…");
  let added = 0;
  for (const [name, address] of SAMPLES.slice(0, 3)) {
    try {
      await api("/contacts", { method: "POST", body: { name, address } });
      added++;
    } catch { /* already exists or limit reached: skip */ }
  }
  setBusy(btn, false);
  await loadContacts();
  toast(added ? `Added ${added} sample contact${added > 1 ? "s" : ""}` : "Sample contacts are already in your list");
  goto("contacts");
}

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

$("#contact-list").addEventListener("click", (e) => {
  if (e.target.closest("#retry-load")) return loadContacts({ initial: true });
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const li = btn.closest("li[data-id]");
  const contact = state.contacts.find((c) => c.id === Number(li.dataset.id));
  if (!contact) return;
  if (btn.dataset.action === "copy") copy(contact.address);
  else if (btn.dataset.action === "ata") openAta(contact);
  else if (btn.dataset.action === "edit") openEdit(contact);
  else if (btn.dataset.action === "delete") openDelete(contact);
});

// ---------- modal plumbing ----------
function openModal(el, focusSel) {
  el.classList.remove("hidden");
  el.classList.add("flex");
  if (focusSel) $(focusSel).focus();
}
function closeModal(el) {
  el.classList.add("hidden");
  el.classList.remove("flex");
}
function wireModal(modalSel, closeSels) {
  const el = $(modalSel);
  closeSels.forEach((s) => $(s).addEventListener("click", () => closeModal(el)));
  el.addEventListener("click", (e) => { if (e.target === el) closeModal(el); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(el); });
  return el;
}

// ---------- delete ----------
const delModal = wireModal("#del-modal", ["#del-cancel"]);
function openDelete(contact) {
  state.deleting = contact;
  $("#del-text").textContent = `“${contact.name}” (${short(contact.address, 8)}) will be removed from your address book. This can't be undone.`;
  openModal(delModal, "#del-cancel");
}
$("#del-confirm").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  setBusy(btn, true, "Deleting…");
  try {
    await api(`/contacts/${state.deleting.id}`, { method: "DELETE" });
    closeModal(delModal);
    toast("Contact deleted");
    await loadContacts();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    setBusy(btn, false);
  }
});

// ---------- edit ----------
const editModal = wireModal("#edit-modal", ["#edit-close", "#edit-cancel"]);
function openEdit(contact) {
  state.editing = contact;
  $("#edit-name").value = contact.name;
  $("#edit-address").value = contact.address;
  showError("#edit-error", "");
  openModal(editModal, "#edit-name");
}
$("#edit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#edit-submit");
  const cur = state.editing;
  const name = $("#edit-name").value.trim();
  const address = $("#edit-address").value.trim();
  showError("#edit-error", "");
  if (!name || !address) return showError("#edit-error", "Name and address can't be empty.");
  const body = {};
  if (name !== cur.name) body.name = name;
  if (address !== cur.address) body.address = address;
  if (!Object.keys(body).length) return closeModal(editModal);
  setBusy(btn, true, "Saving…");
  try {
    const c = await api(`/contacts/${cur.id}`, { method: "PATCH", body });
    closeModal(editModal);
    toast(`Updated “${c.name}”${c.type !== cur.type ? ` — now a ${c.type === "wallet" ? "wallet" : "PDA"}` : ""}`);
    await loadContacts();
  } catch (err) {
    showError("#edit-error", err.message);
  } finally {
    setBusy(btn, false);
  }
});

// ---------- ATA ----------
const ataModal = wireModal("#ata-modal", ["#ata-close"]);
function openAta(contact) {
  state.ataContact = contact;
  $("#ata-owner").textContent = `For ${contact.name} · ${short(contact.address, 6)}`;
  $("#ata-result").classList.add("hidden");
  showError("#ata-error", "");
  openModal(ataModal, "#ata-mint");
}
$$("[data-mint]", ataModal).forEach((b) => b.addEventListener("click", () => {
  $("#ata-mint").value = b.dataset.mint;
  showError("#ata-error", "");
}));

function resultRow(label, value, { copyable = false } = {}) {
  return `<div class="flex items-center justify-between gap-3 py-1.5">
    <div class="min-w-0"><p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">${esc(label)}</p>
    <p class="break-all font-mono text-sm text-slate-900 dark:text-white">${esc(value)}</p></div>
    ${copyable ? `<button type="button" class="icon-btn shrink-0" data-copy="${esc(value)}" title="Copy" aria-label="Copy">${icon("copy")}</button>` : ""}</div>`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-copy]");
  if (b) copy(b.dataset.copy);
});

$("#ata-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#ata-submit");
  const mint = $("#ata-mint").value.trim();
  showError("#ata-error", "");
  $("#ata-result").classList.add("hidden");
  if (!mint) return showError("#ata-error", "Click a token above (like USDC) or paste a mint address first.");
  setBusy(btn, true, "Working…");
  try {
    const r = await api(`/contacts/${state.ataContact.id}/derive-ata`, {
      method: "POST",
      body: { mintAddress: mint, tokenProgram: $("#ata-program").value },
    });
    const out = $("#ata-result");
    out.innerHTML = `<p class="mb-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">Done — this is where their token balance lives:</p>` +
      resultRow("Token account (ATA)", r.ata, { copyable: true }) + resultRow("Bump", String(r.bump)) +
      `<a class="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300" href="${explorer(r.ata)}" target="_blank" rel="noopener noreferrer">View on Explorer ${icon("external", "size-3.5")}</a>`;
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
  row.innerHTML = `<input class="input font-mono" data-seed placeholder="seed word, e.g. metadata" autocomplete="off" spellcheck="false" value="${esc(value)}" />
    <button type="button" class="icon-btn size-10 shrink-0 border border-slate-200 dark:border-white/10" aria-label="Remove this seed" title="Remove this seed">${icon("trash")}</button>`;
  $("button", row).addEventListener("click", () => row.remove());
  $("#seed-list").append(row);
}
function resetSeeds(values) {
  $("#seed-list").innerHTML = "";
  values.forEach(addSeed);
}
resetSeeds(["metadata"]);
$("#seed-add").addEventListener("click", () => addSeed());

async function runPda() {
  const btn = $("#pda-submit");
  showError("#pda-error", "");
  const seeds = $$("[data-seed]").map((i) => i.value);
  if (!$("#pda-program").value.trim()) return showError("#pda-error", "Please enter a Program ID.");
  setBusy(btn, true, "Working…");
  try {
    const r = await api("/derive-pda", { method: "POST", body: { programId: $("#pda-program").value.trim(), seeds } });
    const out = $("#pda-result");
    out.className = "mt-4 flex-1 text-left";
    out.innerHTML = `<div class="animate-pop rounded-xl border border-brand-500/30 bg-brand-500/10 p-4">
        <p class="mb-1 text-sm font-semibold text-brand-700 dark:text-brand-300">Here is your PDA:</p>
        ${resultRow("PDA address", r.pda, { copyable: true })}${resultRow("Canonical bump", String(r.bump))}</div>
      <p class="hint">The same program ID and seeds will always give this exact address.</p>
      <div class="mt-4 flex flex-wrap items-end gap-2">
        <div class="min-w-40 flex-1"><label class="label" for="pda-save-name">Save it as a contact</label><input id="pda-save-name" class="input" maxlength="32" placeholder="Name, e.g. Metadata PDA" autocomplete="off" /></div>
        <button type="button" id="pda-save" class="btn-primary" data-address="${esc(r.pda)}">Save</button>
        <a class="btn-ghost" href="${explorer(r.pda)}" target="_blank" rel="noopener noreferrer">Explorer ${icon("external", "size-3.5")}</a>
      </div>`;
    revealResult(out);
    return r;
  } catch (err) {
    showError("#pda-error", err.message);
  } finally {
    setBusy(btn, false);
  }
}
$("#pda-form").addEventListener("submit", (e) => { e.preventDefault(); runPda(); });
$("#pda-result").addEventListener("click", async (e) => {
  const btn = e.target.closest("#pda-save");
  if (!btn) return;
  const name = $("#pda-save-name").value.trim();
  if (!name) return toast("Type a name for this contact first.", "error");
  setBusy(btn, true, "Saving…");
  try {
    const c = await api("/contacts", { method: "POST", body: { name, address: btn.dataset.address } });
    toast(`Saved “${c.name}” to Contacts`);
    await loadContacts();
  } catch (err) {
    toast(err.message, "error");
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

function revealResult(el) {
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderVerify(valid) {
  const out = $("#verify-result");
  out.className = "mt-4 flex flex-1 items-center justify-center text-center";
  out.innerHTML = valid
    ? `<div class="animate-pop"><div class="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-500"><svg class="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg></div>
        <p class="text-lg font-bold text-emerald-600 dark:text-emerald-400">Signature is valid</p><p class="mx-auto mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">This address really did sign that exact message, so its owner approved it.</p></div>`
    : `<div class="animate-pop"><div class="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-rose-500/15 text-rose-500"><svg class="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></div>
        <p class="text-lg font-bold text-rose-600 dark:text-rose-400">Signature is NOT valid</p><p class="mx-auto mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">The signature doesn't match this address and message. The message may have been changed, or someone else signed it.</p></div>`;
  revealResult(out);
}

async function runVerify() {
  const btn = $("#verify-submit");
  showError("#verify-error", "");
  const address = $("#v-address").value.trim();
  const message = $("#v-message").value;
  const signature = $("#v-signature").value.trim();
  if (!address || !message || !signature) return showError("#verify-error", "Fill in the address, message and signature — or press “Run a valid example” above.");
  setBusy(btn, true, "Checking…");
  try {
    const r = await api("/verify-ownership", { method: "POST", body: { address, message, signature } });
    renderVerify(r.valid);
  } catch (err) {
    showError("#verify-error", err.message === "missing fields or invalid inputs"
      ? "That address or signature isn't valid Base58. Check for typos or missing characters."
      : err.message);
  } finally {
    setBusy(btn, false);
  }
}
$("#verify-form").addEventListener("submit", (e) => { e.preventDefault(); runVerify(); });
$("#v-contact").addEventListener("change", (e) => { if (e.target.value) $("#v-address").value = e.target.value; });

function fillVerifyExample(tamper) {
  $("#v-address").value = EXAMPLE_SIG.address;
  $("#v-message").value = tamper ? `${EXAMPLE_SIG.message}!` : EXAMPLE_SIG.message;
  $("#v-signature").value = EXAMPLE_SIG.signature;
}

$("#phantom-sign").addEventListener("click", async () => {
  showError("#verify-error", "");
  const provider = window.phantom?.solana ?? window.solflare ?? window.solana;
  if (!provider) {
    return showError("#verify-error", "No Solana wallet found in this browser. Install Phantom or Solflare, or press “Run a valid example” to try it without one.");
  }
  try {
    const { publicKey } = await provider.connect();
    const message = $("#v-message").value || "I own this address";
    $("#v-message").value = message;
    const { signature } = await provider.signMessage(new TextEncoder().encode(message), "utf8");
    $("#v-address").value = publicKey.toString();
    $("#v-signature").value = base58Encode(signature);
    await runVerify();
  } catch (err) {
    showError("#verify-error", err?.message || "Signing was cancelled.");
  }
});

// ---------- one-click demos ----------
async function demo(kind, btn) {
  if (kind === "samples") return addSamples(btn);
  if (kind === "pda") {
    goto("pda");
    $("#pda-program").value = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
    resetSeeds(["metadata"]);
    await runPda();
    return toast("Example ran — see the result on the right");
  }
  if (kind === "verify" || kind === "tamper") {
    goto("verify");
    fillVerifyExample(kind === "tamper");
    await runVerify();
    return toast(kind === "tamper" ? "The message was changed, so the signature is invalid" : "Example ran — the signature is valid");
  }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-demo]");
  if (b) demo(b.dataset.demo, b);
});

// ---------- boot ----------
checkHealth();
loadContacts({ initial: true });
fromHash();
