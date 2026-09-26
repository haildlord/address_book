// Apply saved theme before paint to avoid a flash (kept external so CSP can forbid inline scripts).
try {
  if (localStorage.getItem("theme") === "light") document.documentElement.classList.remove("dark");
} catch {}
