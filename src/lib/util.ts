/** Pure, framework-free utilities. All of these are unit-testable without any live website. */

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** FNV-1a 32-bit hash → hex string. Deterministic across sessions. */
export function hashStr(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function seedFrom(...parts: string[]): number {
  return parseInt(hashStr(parts.join("::")), 16);
}

/** Small deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function rint(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function fmtPrice(n: number | undefined, currency?: string): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
  return currency ? `${formatted} ${currency}` : formatted;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/* ---------------- price parsing (multi-format) ---------------- */

const CURRENCY_WORDS = [
  "cad", "usd", "pln", "chf", "eur", "gbp", "zl", "zł", "fr", "sfr", "ca$", "c$", "$", "€", "£",
];

/**
 * Parse human price strings such as:
 *  "CA$1,299.00" · "399 zł" · "CHF 1'299.50" · "1 299,50 zł" · "45 000" · "VHB 250 €" · "Free"
 * Returns a float, 0 for "free/gratis", or null when unparseable.
 */
export function parsePrice(input: string | null | undefined): number | null {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;

  const lower = s.toLowerCase();
  if (/\b(free|gratis|gratuit|za darmo|zu verschenken)\b/.test(lower)) return 0;
  if (/\b(vhb|obo|negotiable|do negocjacji|à discuter|verhandelbaar)\b/.test(lower)) {
    s = s.replace(/\b(vhb|obo|negotiable|do negocjacji|à discuter|verhandelbaar)\b/gi, "");
  }

  // strip currency symbols / words
  for (const w of CURRENCY_WORDS) {
    s = s.split(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")).join(" ");
  }
  s = s.replace(/[^\d.,'\s]/g, " ").replace(/[\s\u00a0]+/g, "").replace(/'/g, "");
  if (!/\d/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  let cleaned: string;
  if (lastComma >= 0 && lastDot >= 0) {
    // the later separator is the decimal one
    if (lastComma > lastDot) cleaned = s.replace(/\./g, "").replace(",", ".");
    else cleaned = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const decimals = s.length - lastComma - 1;
    const commaCount = (s.match(/,/g) || []).length;
    cleaned = decimals <= 2 && commaCount === 1 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (lastDot >= 0) {
    const decimals = s.length - lastDot - 1;
    const dotCount = (s.match(/\./g) || []).length;
    cleaned = decimals <= 2 && dotCount === 1 ? s : s.replace(/\./g, "");
  } else {
    cleaned = s;
  }

  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Detect an ISO currency code from a raw price string. */
export function parseCurrency(input: string | null | undefined, fallback = "EUR"): string {
  if (!input) return fallback;
  const s = input.toLowerCase();
  if (/(zł|zl|pln)/.test(s)) return "PLN";
  if (/(chf|sfr|fr\.)/.test(s)) return "CHF";
  if (/(ca\$|c\$|cad)/.test(s)) return "CAD";
  if (/(£|gbp)/.test(s)) return "GBP";
  if (/(€|eur)/.test(s)) return "EUR";
  if (/(\$|usd)/.test(s)) return "USD";
  return fallback;
}

/* ---------------- URL normalization ---------------- */

const TRACKING_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "ref", "referrer", "src", "spm", "source"];

export function normalizeUrl(input: string): string {
  try {
    const u = new URL(input.trim());
    u.hash = "";
    for (const key of Array.from(u.searchParams.keys())) {
      if (TRACKING_PARAMS.some((t) => key.toLowerCase().startsWith(t))) u.searchParams.delete(key);
    }
    let out = u.toString();
    if (out.endsWith("/") && u.pathname !== "/") out = out.slice(0, -1);
    return out;
  } catch {
    return input.trim().toLowerCase();
  }
}

/* ---------------- deduplication ---------------- */

export interface DedupeInput {
  marketplace: string;
  marketplace_listing_id?: string;
  url?: string;
  title?: string;
  price?: number;
  location?: string;
}

/**
 * Three-tier dedup key:
 *  1) marketplace + listing id   2) canonical url   3) hash(market|title|price|location)
 */
export function dedupeKey(d: DedupeInput): string {
  if (d.marketplace_listing_id) return `${d.marketplace}:id:${d.marketplace_listing_id.toLowerCase()}`;
  if (d.url) return `${d.marketplace}:url:${normalizeUrl(d.url)}`;
  const raw = [d.marketplace, (d.title || "").trim().toLowerCase(), d.price ?? "", (d.location || "").trim().toLowerCase()].join("|");
  return `${d.marketplace}:h:${hashStr(raw)}`;
}

/* ---------------- misc ---------------- */

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "listing";
}

export function csvEscape(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
}

export async function sha256(s: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return hashStr(s) + hashStr(s.split("").reverse().join(""));
  }
}
