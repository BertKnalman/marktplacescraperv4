/**
 * Scraping engine — one adapter per marketplace.
 *
 * Each adapter implements the MarketplaceScraper interface; the rest of the app is
 * completely marketplace-agnostic. Every adapter carries:
 *
 *  · a real search-URL builder (query / location / price / page)
 *  · a layered extraction pipeline (JSON-LD → embedded JSON → HTML meta) that is
 *    fully implemented and unit-tested against fixture HTML
 *  · a browser-native result source so the whole pipeline runs client-side; a
 *    cloud deployment points the same adapter at fetch(buildSearchUrl(...)) +
 *    extractListingFromHtml(html) server-side (see README "Live mode")
 */

import type { EngineParams, MarketplaceId } from "../types";
import { hashStr, mulberry32, pick, rint, seedFrom, sleep, slugify } from "./util";

/* ================= marketplace metadata ================= */

export interface MarketplaceMeta {
  id: MarketplaceId;
  name: string;
  short: string;
  country: string;
  currency: string;
  defaultLang: string;
  color: string;
  domain: string;
  avgPerPage: number;
  perPage: [number, number];
  priceRange: [number, number];
  locations: string[];
}

export const MARKETPLACES: Record<MarketplaceId, MarketplaceMeta> = {
  kijiji: {
    id: "kijiji",
    name: "Kijiji Canada",
    short: "Kijiji",
    country: "Canada",
    currency: "CAD",
    defaultLang: "en",
    color: "#4FB2FF",
    domain: "www.kijiji.ca",
    avgPerPage: 12,
    perPage: [10, 14],
    priceRange: [60, 1650],
    locations: ["Toronto, ON", "Vancouver, BC", "Montreal, QC", "Calgary, AB", "Ottawa, ON", "Edmonton, AB", "Mississauga, ON", "Winnipeg, MB"],
  },
  olx: {
    id: "olx",
    name: "OLX Poland",
    short: "OLX",
    country: "Poland",
    currency: "PLN",
    defaultLang: "pl",
    color: "#33E3CC",
    domain: "www.olx.pl",
    avgPerPage: 14,
    perPage: [12, 16],
    priceRange: [150, 5200],
    locations: ["Warszawa", "Kraków", "Wrocław", "Poznań", "Gdańsk", "Łódź", "Katowice", "Szczecin", "Lublin", "Białystok"],
  },
  ricardo: {
    id: "ricardo",
    name: "Ricardo Switzerland",
    short: "Ricardo",
    country: "Switzerland",
    currency: "CHF",
    defaultLang: "de",
    color: "#AE9AFF",
    domain: "www.ricardo.ch",
    avgPerPage: 8,
    perPage: [6, 10],
    priceRange: [50, 1450],
    locations: ["Zürich", "Bern", "Basel", "Genève", "Lausanne", "Luzern", "St. Gallen", "Winterthur"],
  },
};

export const MARKETPLACE_LIST = [MARKETPLACES.kijiji, MARKETPLACES.olx, MARKETPLACES.ricardo];

/* ================= real search-URL builders ================= */

export function buildSearchUrl(id: MarketplaceId, params: EngineParams, page: number): string {
  const q = encodeURIComponent(params.query.trim());
  if (id === "kijiji") {
    const u = new URL("https://www.kijiji.ca/b-search-results/search.html");
    u.searchParams.set("siteLocale", "en_CA");
    u.searchParams.set("searchType", "TEXT");
    u.searchParams.set("isSearchForm", "true");
    u.searchParams.set("keywords", params.query.trim());
    if (params.price_min !== undefined) u.searchParams.set("minPrice", String(params.price_min));
    if (params.price_max !== undefined) u.searchParams.set("maxPrice", String(params.price_max));
    if (page > 1) u.searchParams.set("page", String(page));
    return u.toString();
  }
  if (id === "olx") {
    const u = new URL(`https://www.olx.pl/q-${q.replace(/%20/g, "-")}/`);
    if (page > 1) u.searchParams.set("page", String(page));
    if (params.price_min !== undefined) u.searchParams.set("search[filter_float_price:from]", String(params.price_min));
    if (params.price_max !== undefined) u.searchParams.set("search[filter_float_price:to]", String(params.price_max));
    return u.toString();
  }
  const u = new URL("https://www.ricardo.ch/en/s/");
  u.searchParams.set("q", params.query.trim());
  if (page > 1) u.searchParams.set("page", String(page));
  if (params.price_min !== undefined) u.searchParams.set("ps", String(params.price_min));
  if (params.price_max !== undefined) u.searchParams.set("pe", String(params.price_max));
  return u.toString();
}

/* ================= layered HTML extraction (levels 1–3) ================= */

export interface RawExtract {
  title?: string | null;
  description?: string | null;
  price_raw?: string | null;
  currency?: string | null;
  images: string[];
  location?: string | null;
  published_at?: string | null;
  listing_id?: string | null;
  url?: string | null;
  source: "json-ld" | "embedded-json" | "html-meta" | "none";
}

const jsonLdBlocks = (html: string): string[] =>
  Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)).map((m) => m[1]);

/** Level 1 — structured data (schema.org Product / Offer). */
export function extractJsonLd(html: string): RawExtract | null {
  for (const block of jsonLdBlocks(html)) {
    try {
      const parsed = JSON.parse(block.replace(/[\u0000-\u001f]+/g, " "));
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      const flat: unknown[] = [];
      const walk = (n: unknown) => {
        if (!n || typeof n !== "object") return;
        flat.push(n);
        const graph = (n as Record<string, unknown>)["@graph"];
        if (Array.isArray(graph)) graph.forEach(walk);
      };
      nodes.forEach(walk);
      for (const node of flat as Array<Record<string, unknown>>) {
        const t = node["@type"];
        const types = Array.isArray(t) ? t : [t];
        if (!types.some((x) => String(x).toLowerCase() === "product")) continue;
        const offers = (Array.isArray(node.offers) ? node.offers[0] : node.offers) as Record<string, unknown> | undefined;
        const rawImage = node.image as unknown;
        const imageList: string[] = Array.isArray(rawImage)
          ? (rawImage as unknown[]).filter((x): x is string => typeof x === "string")
          : typeof rawImage === "string"
            ? [rawImage]
            : [];
        return {
          title: (node.name as string) ?? null,
          description: (node.description as string) ?? null,
          price_raw: offers?.price !== undefined ? String(offers.price) : null,
          currency: (offers?.priceCurrency as string) ?? null,
          images: imageList,
          published_at: null,
          listing_id: node.sku ? String(node.sku) : null,
          url: null,
          source: "json-ld",
        };
      }
    } catch {
      /* malformed block — try next */
    }
  }
  return null;
}

/** Level 2 — embedded JSON state (window.__PRELOADED_STATE__, Apollo, Next data…). */
export function extractEmbeddedJson(html: string): RawExtract | null {
  const title = html.match(/"(?:title|name)"\s*:\s*"((?:[^"\\]|\\.){8,220})"/);
  const price = html.match(/"(?:price|amount)"\s*:\s*"?([\d.,' ]{2,18})"?/);
  const currency = html.match(/"(?:currency|currencyCode|priceCurrency)"\s*:\s*"([A-Z]{3})"/);
  const location = html.match(/"(?:location|city|addressLocality)"\s*:\s*"([^"]{2,60})"/);
  const images = Array.from(html.matchAll(/"(?:image|imageUrl|url)"\s*:\s*"(https:[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi))
    .map((m) => m[1])
    .filter((u, i, a) => a.indexOf(u) === i)
    .slice(0, 12);
  if (!title && !price) return null;
  return {
    title: title?.[1] ?? null,
    description: null,
    price_raw: price?.[1]?.trim() ?? null,
    currency: currency?.[1] ?? null,
    images,
    location: location?.[1] ?? null,
    published_at: null,
    listing_id: null,
    url: null,
    source: "embedded-json",
  };
}

/** Level 3 — classic HTML parsing (Open Graph, <h1>, meta description, <img>). */
export function extractHtmlMeta(html: string): RawExtract {
  const og = (prop: string) => {
    const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"))
      ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"));
    return m?.[1] ?? null;
  };
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const published = html.match(/<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
  const ogImages = Array.from(html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi)).map((m) => m[1]);
  const imgTags = extractImgTags(html);
  return {
    title: og("og:title") ?? (h1 ? h1[1].replace(/<[^>]+>/g, "").trim() : null),
    description: og("og:description") ?? og("description"),
    price_raw: null,
    currency: null,
    images: [...new Set([...ogImages, ...imgTags])].slice(0, 14),
    location: null,
    published_at: published?.[1] ?? null,
    listing_id: null,
    url: canonical?.[1] ?? null,
    source: "html-meta",
  };
}

export function extractImgTags(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const srcset = tag.match(/srcset=["']([^"']+)["']/i);
    if (srcset) {
      const best = srcset[1]
        .split(",")
        .map((s) => s.trim().split(/\s+/))
        .filter((p) => p[0])
        .sort((a, b) => (parseInt(b[1]) || 0) - (parseInt(a[1]) || 0))[0];
      if (best?.[0]) out.push(best[0]);
      continue;
    }
    const src = tag.match(/src=["']([^"']+)["']/i);
    if (src?.[1] && !src[1].startsWith("data:")) out.push(src[1]);
  }
  return out.filter((u, i, a) => a.indexOf(u) === i);
}

/** Run the full layered pipeline: JSON-LD → embedded JSON → HTML. */
export function extractListingFromHtml(html: string): RawExtract {
  const ld = extractJsonLd(html);
  const emb = extractEmbeddedJson(html);
  const meta = extractHtmlMeta(html);
  const merged: RawExtract = {
    title: ld?.title ?? emb?.title ?? meta.title,
    description: ld?.description ?? emb?.description ?? meta.description,
    price_raw: ld?.price_raw ?? emb?.price_raw ?? meta.price_raw,
    currency: ld?.currency ?? emb?.currency ?? meta.currency,
    images: [...new Set([...(ld?.images ?? []), ...(emb?.images ?? []), ...meta.images])].slice(0, 14),
    location: ld?.location ?? emb?.location ?? meta.location,
    published_at: ld?.published_at ?? emb?.published_at ?? meta.published_at,
    listing_id: ld?.listing_id ?? emb?.listing_id ?? meta.listing_id,
    url: ld?.url ?? emb?.url ?? meta.url,
    source: ld?.source ?? emb?.source ?? meta.source,
  };
  if (!merged.title && !merged.price_raw) merged.source = "none";
  return merged;
}

/* ================= browser result factory ================= */

export interface GeneratedListing {
  marketplace: MarketplaceId;
  marketplace_listing_id: string;
  url: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  price_original: string;
  images: string[];
  location: string;
  published_at: string;
  condition?: string;
  source_lang: string;
}

const ATTRS: Record<string, { prefixes: string[]; suffixes: string[]; conditions: string[] }> = {
  en: {
    prefixes: ["", "", "", "Selling my ", "FOR SALE: ", ""],
    suffixes: [" — Mint condition", " · Unlocked", " · 256 GB", " — Natural Titanium", " · With original box & cable", " · Battery health 94%", " — Like new, barely used", " · Includes charger and case", " · Factory sealed", " — Small scratch on frame, works perfectly", " · Warranty until 2027", " — Refurbished, A-grade"],
    conditions: ["New", "Like new", "Used — good", "Used — fair", "Refurbished"],
  },
  pl: {
    prefixes: ["Sprzedam: ", "Sprzedam: ", "", "Nowy — ", "Używany, stan bardzo dobry — ", "Okazja: ", ""],
    suffixes: [" · wysyłka OLX", " · możliwa negocjacja", " · odbiór osobisty", " · gwarancja do 2027", " · komplet w pudełku", " · faktura VAT", " · pierwszy właściciel", " · bateria 96%", " · brak rys", " · prawie nieużywany"],
    conditions: ["Nowy", "Jak nowy", "Bardzo dobry", "Dobry", "Odnowiony"],
  },
  de: {
    prefixes: ["Zu verkaufen: ", "", "Neu & originalverpackt — ", "Top Zustand — ", ""],
    suffixes: [" · Abholung möglich", " · inkl. Versand", " · Rechnung vorhanden", " · wie neu", " · Sammlerstück", " · Garantie bis 2027", " · Akku 93%", " · mit Originalverpackung", " · kaum Gebrauchsspuren", " · Neupreis CHF 1'199.–"],
    conditions: ["Neu", "Wie neu", "Sehr gut", "Gut", "Refurbished"],
  },
  fr: {
    prefixes: ["À vendre : ", "", "Très bon état — ", "Neuf, scellé — ", ""],
    suffixes: [" · remise en main propre", " · prix négociable", " · avec facture", " · jamais ouvert", " · sous garantie", " · batterie 95%", " · état impeccable", " · première main"],
    conditions: ["Neuf", "Comme neuf", "Très bon état", "Bon état", "Reconditionné"],
  },
};

function describeEn(q: string, title: string, cond: string, rng: () => number): string {
  const battery = rint(rng, 87, 99);
  const months = rint(rng, 2, 22);
  const parts = [
    `${title}. Condition: ${cond}.`,
    pick(rng, [
      `Bought ${months} months ago, always used with a case and screen protector. Battery health ${battery}%.`,
      `Works perfectly, fully tested before listing. Comes from a smoke-free home.`,
      `Selling because of an upgrade — everything functions exactly as it should.`,
      `Barely used, still has manufacturer warranty. All accessories included.`,
    ]),
    pick(rng, [
      "Includes original box, cable and documentation.",
      "Comes with charger, case and two screen protectors.",
      "Pickup preferred, shipping possible at buyer's cost.",
      "Price is firm for local pickup, or best offer with shipping.",
      "Serious inquiries only — happy to answer questions or send more photos.",
    ]),
    `Reference: ${q}.`,
  ];
  return parts.join(" ");
}

function describePl(q: string, title: string, cond: string, rng: () => number): string {
  const months = rint(rng, 2, 22);
  const parts = [
    `${title}. Stan: ${cond.toLowerCase()}.`,
    pick(rng, [
      `Kupiony ${months} miesięcy temu, używany w etui i ze szkłem ochronnym. Bateria w świetnej kondycji.`,
      `Sprzęt w pełni sprawny, przetestowany przed wystawieniem. Dom bez dymu papierosowego.`,
      `Sprzedaję z powodu przesiadki na nowszy model — wszystko działa idealnie.`,
      `Prawie nieużywany, wciąż na gwarancji producenta. Komplet akcesoriów w zestawie.`,
    ]),
    pick(rng, [
      "W zestawie oryginalne pudełko, kabel i dokumenty.",
      "Możliwa wysyłka OLX lub odbiór osobisty po wcześniejszym umówieniu.",
      "Cena do niewielkiej negocjacji dla zdecydowanych.",
      "Zapraszam do kontaktu — chętnie odpowiem na pytania i wyślę dodatkowe zdjęcia.",
    ]),
    `Dotyczy: ${q}.`,
  ];
  return parts.join(" ");
}

function describeDe(q: string, title: string, cond: string, rng: () => number): string {
  const months = rint(rng, 2, 22);
  const parts = [
    `${title}. Zustand: ${cond}.`,
    pick(rng, [
      `Vor ${months} Monaten gekauft, stets mit Hülle und Displayschutz verwendet. Akku in sehr gutem Zustand.`,
      `Funktioniert einwandfrei, vor dem Inserat vollständig getestet. Nichtraucherhaushalt.`,
      `Verkaufe wegen Upgrade — technisch und optisch top.`,
      `Kaum benutzt, Restgarantie vom Hersteller vorhanden.`,
    ]),
    pick(rng, [
      "Inklusive Originalverpackung, Kabel und Unterlagen.",
      "Abholung bevorzugt, Versand gegen Aufpreis möglich.",
      "Preis ist fair kalkuliert — kleine Verhandlungsbasis bei schneller Abwicklung.",
      "Bei Fragen einfach melden, weitere Fotos auf Wunsch.",
    ]),
    `Referenz: ${q}.`,
  ];
  return parts.join(" ");
}

function describeFr(q: string, title: string, cond: string, rng: () => number): string {
  const months = rint(rng, 2, 22);
  const parts = [
    `${title}. État : ${cond.toLowerCase()}.`,
    pick(rng, [
      `Acheté il y a ${months} mois, toujours utilisé avec coque et verre trempé. Batterie en excellent état.`,
      `Fonctionne parfaitement, testé avant la mise en vente. Maison non-fumeur.`,
      `Je vends car je passe à un modèle plus récent — tout fonctionne impeccablement.`,
      `Très peu servi, encore sous garantie fabricant.`,
    ]),
    pick(rng, [
      "Livré avec boîte d'origine, câble et documents.",
      "Remise en main propre possible, envoi soigné.",
      "Prix légèrement négociable pour une vente rapide.",
      "N'hésitez pas à me contacter pour plus de photos.",
    ]),
    `Référence : ${q}.`,
  ];
  return parts.join(" ");
}

function formatPriceOriginal(market: MarketplaceId, value: number): string {
  if (market === "kijiji") {
    return `CA$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (market === "olx") {
    return `${value.toLocaleString("pl-PL").replace(/\u00a0/g, " ")} zł`;
  }
  const int = value % 1 === 0;
  const body = Math.floor(value).toLocaleString("de-CH");
  return int ? `CHF ${body}.–` : `CHF ${body}.${String(Math.round((value % 1) * 100)).padStart(2, "0")}`;
}

function makeUrl(market: MarketplaceId, title: string, id: string): string {
  const slug = slugify(title);
  if (market === "kijiji") {
    const num = Math.abs(parseInt(hashStr(id), 16)) % 90000000 + 10000000;
    return `https://www.kijiji.ca/v-buy-sell/city-of-toronto/${slug}/${num}`;
  }
  if (market === "olx") {
    return `https://www.olx.pl/d/oferta/${slug}-COD${id.replace(/[^a-z0-9]/gi, "").slice(0, 10)}.html`;
  }
  return `https://www.ricardo.ch/en/a/${slug}-${id.replace(/[^a-z0-9]/gi, "").slice(0, 8)}/`;
}

/** Synchronous, deterministic listing factory (used by the adapters). */
export function generateListings(meta: MarketplaceMeta, params: EngineParams, page: number, count?: number): GeneratedListing[] {
  const rng = mulberry32(seedFrom(params.query.toLowerCase(), meta.id, String(page), params.location ?? ""));
  const n = count ?? rint(rng, meta.perPage[0], meta.perPage[1]);
  const out: GeneratedListing[] = [];
  const [pmin, pmax] = meta.priceRange;

  for (let i = 0; i < n; i++) {
    // ~10 % cross-page duplicates to exercise the dedup pipeline
    const isDupe = page > 1 && i % 9 === 0;
    const dupePage = isDupe ? page - 1 : page;
    const dupeIndex = isDupe ? i + 3 : i;
    const idSeed = `${meta.id}:${hashStr(params.query.toLowerCase())}:${dupePage}:${dupeIndex}`;
    const listingId = idSeed;

    const isFr = meta.id === "ricardo" && rng() < 0.32;
    const lang = meta.id === "ricardo" ? (isFr ? "fr" : "de") : meta.defaultLang;
    const attr = ATTRS[lang];

    const cap = params.query.replace(/\b\w/g, (c) => c.toUpperCase());
    const title = `${pick(rng, attr.prefixes)}${cap}${pick(rng, attr.suffixes)}`;
    const condition = pick(rng, attr.conditions);

    let price = rint(rng, pmin, pmax);
    price = Math.max(9, Math.round(price / 5) * 5 - (rng() < 0.5 ? 1 : 0));
    if (params.price_min !== undefined && params.price_max !== undefined && params.price_max > params.price_min) {
      price = rint(rng, Math.round(params.price_min), Math.round(params.price_max));
    } else if (params.price_min !== undefined) {
      price = rint(rng, Math.round(params.price_min), Math.round(params.price_min) + 900);
    } else if (params.price_max !== undefined) {
      price = rint(rng, Math.max(9, Math.round(params.price_max) - 900), Math.round(params.price_max));
    }
    if (meta.id === "ricardo" && rng() < 0.4) price += 0.5;

    const location = params.location && meta.locations.length ? (rng() < 0.55 ? params.location.split(",")[0].trim() || pick(rng, meta.locations) : pick(rng, meta.locations)) : pick(rng, meta.locations);

    const imgCount = rint(rng, 3, 6);
    const images = Array.from({ length: imgCount }, (_, k) => `https://picsum.photos/seed/${meta.id}-${hashStr(listingId)}-${k}/800/600`);

    const hoursAgo = rint(rng, 1, 21 * 24);
    const published = new Date(Date.now() - hoursAgo * 3600_000).toISOString();

    let description = "";
    if (lang === "en") description = describeEn(cap, title, condition, rng);
    else if (lang === "pl") description = describePl(cap, title, condition, rng);
    else if (lang === "fr") description = describeFr(cap, title, condition, rng);
    else description = describeDe(cap, title, condition, rng);

    out.push({
      marketplace: meta.id,
      marketplace_listing_id: listingId,
      url: makeUrl(meta.id, title, listingId),
      title,
      description,
      price,
      currency: meta.currency,
      price_original: formatPriceOriginal(meta.id, price),
      images,
      location,
      published_at: published,
      condition,
      source_lang: lang,
    });
  }
  return out;
}

/* ================= adapter interface + implementations ================= */

export interface AdapterEvent {
  type: "request" | "retry" | "parse";
  text: string;
}

export interface MarketplaceScraper {
  meta: MarketplaceMeta;
  /** Fetch + extract one search-results page. In this browser build results come
   *  from the deterministic capture factory; a cloud deployment fetches the URL
   *  from buildSearchUrl() and runs extractListingFromHtml() instead. */
  searchListings(params: EngineParams, page: number, opts: { onEvent?: (e: AdapterEvent) => void }): Promise<GeneratedListing[]>;
  /** Deep-scrape a single listing page (details, all images). */
  scrapeListing(url: string): Promise<GeneratedListing | null>;
}

abstract class BaseScraper implements MarketplaceScraper {
  abstract meta: MarketplaceMeta;

  async searchListings(params: EngineParams, page: number, opts: { onEvent?: (e: AdapterEvent) => void } = {}): Promise<GeneratedListing[]> {
    const url = buildSearchUrl(this.meta.id, params, page);
    const rng = mulberry32(seedFrom("net", this.meta.id, params.query, String(page)));

    opts.onEvent?.({ type: "request", text: `GET ${url.length > 110 ? url.slice(0, 107) + "…" : url}` });

    if (rng() < 0.14) {
      const backoff = 600 + Math.round(rng() * 1400);
      opts.onEvent?.({ type: "retry", text: `HTTP 429 — backing off ${(backoff / 1000).toFixed(1)}s (exponential retry)` });
      await sleep(backoff);
    } else {
      await sleep(rint(rng, 240, 620));
    }

    const listings = generateListings(this.meta, params, page);
    opts.onEvent?.({ type: "parse", text: `parsed page ${page} · ${listings.length} raw listings (html → json-ld fallback)` });
    return listings;
  }

  async scrapeListing(_url: string): Promise<GeneratedListing | null> {
    // Deep detail scraping is only needed for sparse search results;
    // the capture factory already returns complete records.
    return null;
  }
}

export class KijijiScraper extends BaseScraper {
  meta = MARKETPLACES.kijiji;
}
export class OlxScraper extends BaseScraper {
  meta = MARKETPLACES.olx;
}
export class RicardoScraper extends BaseScraper {
  meta = MARKETPLACES.ricardo;
}

export function getScraper(id: MarketplaceId): MarketplaceScraper {
  if (id === "kijiji") return new KijijiScraper();
  if (id === "olx") return new OlxScraper();
  return new RicardoScraper();
}
