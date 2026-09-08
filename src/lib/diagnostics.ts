/**
 * Offline unit-test suite. Runs against fixture HTML only — no live website is
 * contacted. Executable from Settings → Diagnostics.
 */

import { dedupeKey, hashStr, normalizeUrl, parseCurrency, parsePrice } from "./util";
import { extractEmbeddedJson, extractHtmlMeta, extractJsonLd, extractListingFromHtml } from "./scraper";
import { translateText } from "./translation";
import { getTranslations, putTranslations } from "./db";
import { listingsToCsv } from "./export";
import type { Listing } from "../types";
import { uuid } from "./util";

export interface DiagResult {
  name: string;
  pass: boolean;
  detail: string;
}

const FIXTURE_JSONLD = `<!doctype html><html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"iPhone 15 Pro 256GB Natural Titanium",
"description":"Mint condition, original box included.","sku":"KJ-88213",
"image":["https://img.example.com/a.jpg","https://img.example.com/b.jpg"],
"offers":{"@type":"Offer","price":"1299.00","priceCurrency":"CAD"}}
</script>
<meta property="og:title" content="OG fallback title" />
<meta property="og:image" content="https://img.example.com/og.jpg" />
<link rel="canonical" href="https://www.kijiji.ca/v-item/toronto/iphone-15-pro/12345?utm_source=google&ref=newsletter" />
<meta itemprop="datePublished" content="2026-02-10T09:30:00Z" />
</head><body><h1>HTML fallback title</h1>
<img src="https://img.example.com/one.jpg" alt="photo" />
<img srcset="https://img.example.com/small.jpg 480w, https://img.example.com/large.jpg 1024w" />
</body></html>`;

const FIXTURE_EMBEDDED = `<!doctype html><html><head><title>OLX listing</title></head><body>
<script>window.__PRELOADED_STATE__ = {"listing":{"title":"Sony WH-1000XM5 Black","price":"1 299,50","currency":"PLN","city":"Warszawa","imageUrl":"https://img.example.com/state.jpg"}};</script>
</body></html>`;

function eq(label: string, actual: unknown, expected: unknown): DiagResult {
  const pass = Object.is(actual, expected);
  return { name: label, pass, detail: pass ? `→ ${String(expected)}` : `expected ${String(expected)}, got ${String(actual)}` };
}

export function runDiagnostics(): DiagResult[] {
  const out: DiagResult[] = [];

  /* price parsing */
  out.push(eq("parsePrice: CA$1,299.00", parsePrice("CA$1,299.00"), 1299));
  out.push(eq("parsePrice: 399 zł", parsePrice("399 zł"), 399));
  out.push(eq("parsePrice: CHF 1'299.50", parsePrice("CHF 1'299.50"), 1299.5));
  out.push(eq("parsePrice: 1 299,50 zł", parsePrice("1 299,50 zł"), 1299.5));
  out.push(eq("parsePrice: 45 000", parsePrice("45 000"), 45000));
  out.push(eq("parsePrice: VHB 250 €", parsePrice("VHB 250 €"), 250));
  out.push(eq("parsePrice: Free", parsePrice("Free"), 0));
  out.push(eq("parsePrice: 'price on request' → null", parsePrice("price on request"), null));

  /* currency detection */
  out.push(eq("parseCurrency: zł → PLN", parseCurrency("399 zł"), "PLN"));
  out.push(eq("parseCurrency: CHF → CHF", parseCurrency("CHF 1'299.–"), "CHF"));
  out.push(eq("parseCurrency: CA$ → CAD", parseCurrency("CA$99.00"), "CAD"));
  out.push(eq("parseCurrency: € → EUR", parseCurrency("€ 45,00"), "EUR"));

  /* URL normalization */
  const norm = normalizeUrl("https://www.Kijiji.ca/v-item/toronto/iphone/12345?utm_source=google&ref=x&keep=1#top");
  out.push({
    name: "normalizeUrl: strips tracking + hash",
    pass: norm === "https://www.kijiji.ca/v-item/toronto/iphone/12345?keep=1",
    detail: `→ ${norm}`,
  });

  /* dedup tiers */
  const k1 = dedupeKey({ marketplace: "olx", marketplace_listing_id: "OLX-1", url: "https://x" });
  const k2 = dedupeKey({ marketplace: "olx", marketplace_listing_id: "OLX-1", url: "https://y" });
  out.push({ name: "dedupe tier 1: marketplace + listing id", pass: k1 === k2, detail: k1 });
  const k3 = dedupeKey({ marketplace: "kijiji", url: "https://a.example/p?utm_source=x" });
  const k4 = dedupeKey({ marketplace: "kijiji", url: "https://a.example/p" });
  out.push({ name: "dedupe tier 2: canonical URL", pass: k3 === k4, detail: k3 });
  const k5 = dedupeKey({ marketplace: "ricardo", title: "iPhone 15", price: 999, location: "Bern" });
  const k6 = dedupeKey({ marketplace: "ricardo", title: " iphone 15 ", price: 999, location: "bern" });
  out.push({ name: "dedupe tier 3: fuzzy hash (title+price+location)", pass: k5 === k6, detail: k5 });

  /* extraction levels */
  const ld = extractJsonLd(FIXTURE_JSONLD);
  out.push({ name: "level 1 JSON-LD: title", pass: ld?.title === "iPhone 15 Pro 256GB Natural Titanium", detail: `→ ${ld?.title}` });
  out.push({ name: "level 1 JSON-LD: price + currency", pass: ld?.price_raw === "1299.00" && ld?.currency === "CAD", detail: `${ld?.price_raw} ${ld?.currency}` });
  out.push({ name: "level 1 JSON-LD: images[]", pass: ld?.images.length === 2, detail: `${ld?.images.length} images` });
  out.push({ name: "level 1 JSON-LD: listing id (sku)", pass: ld?.listing_id === "KJ-88213", detail: `→ ${ld?.listing_id}` });

  const emb = extractEmbeddedJson(FIXTURE_EMBEDDED);
  out.push({ name: "level 2 embedded JSON: title", pass: emb?.title === "Sony WH-1000XM5 Black", detail: `→ ${emb?.title}` });
  out.push({ name: "level 2 embedded JSON: raw price", pass: emb?.price_raw === "1 299,50" && parsePrice(emb?.price_raw) === 1299.5, detail: `→ ${emb?.price_raw}` });
  out.push({ name: "level 2 embedded JSON: location", pass: emb?.location === "Warszawa", detail: `→ ${emb?.location}` });

  const meta = extractHtmlMeta(FIXTURE_JSONLD);
  out.push({ name: "level 3 HTML: og:title", pass: meta.title === "OG fallback title", detail: `→ ${meta.title}` });
  out.push({ name: "level 3 HTML: srcset picks largest", pass: meta.images.includes("https://img.example.com/large.jpg"), detail: meta.images.join(", ") });
  out.push({ name: "level 3 HTML: canonical url", pass: meta.url?.includes("utm_source") === true, detail: `→ ${meta.url}` });
  out.push({ name: "level 3 HTML: datePublished", pass: meta.published_at === "2026-02-10T09:30:00Z", detail: `→ ${meta.published_at}` });

  const merged = extractListingFromHtml(FIXTURE_JSONLD);
  out.push({ name: "layering: JSON-LD wins over OG", pass: merged.title === "iPhone 15 Pro 256GB Natural Titanium" && merged.source === "json-ld", detail: `source=${merged.source}` });

  /* translation + cache */
  const pl = translateText("Sprzedam: iPhone 15, stan bardzo dobry, możliwa wysyłka", "pl");
  out.push({ name: "translate PL→DE phrase", pass: pl.includes("verkaufe") && pl.toLowerCase().includes("sehr guter zustand"), detail: `→ ${pl}` });
  const en = translateText("Selling my iPhone — like new, original box", "en");
  out.push({ name: "translate EN→DE", pass: en.startsWith("Verkaufe") && en.toLowerCase().includes("als neu"), detail: `→ ${en}` });
  const de = translateText("Zu verkaufen: iPhone neu", "de");
  out.push({ name: "translate DE→DE passthrough", pass: de === "Zu verkaufen: iPhone neu", detail: `→ ${de}` });

  const hash = hashStr("diag:" + uuid());
  putTranslations([{
    id: uuid(), user_id: "diagnostics", source_text_hash: hash, source_text: "diag text",
    source_lang: "en", target_language: "de", translated_text: "Diagnosetext", created_at: new Date().toISOString(),
  }]);
  const cached = getTranslations([hash]);
  out.push({ name: "translation cache round-trip", pass: cached.get(hash)?.translated_text === "Diagnosetext", detail: `hash ${hash.slice(0, 8)}…` });

  /* CSV */
  const sample: Listing = {
    id: uuid(), user_id: "diagnostics", marketplace: "olx", marketplace_listing_id: "T-1",
    url: "https://olx.pl/d/oferta/test.html", title_original: 'Test "quote"', title_german: "Test",
    description_original: "a,b\nc", description_german: "d", price: 99.5, currency: "PLN",
    price_original: "99,50 zł", images: ["https://img.example.com/1.jpg"], location: "Warszawa",
    published_at: new Date().toISOString(), source_lang: "pl", search_id: "s", run_id: "r",
    first_seen: new Date().toISOString(), last_seen: new Date().toISOString(), scraped_at: new Date().toISOString(),
  };
  const csv = listingsToCsv([sample]);
  out.push({ name: "CSV: header + escaping", pass: csv.startsWith("\uFEFFmarketplace,") && csv.includes('"""quote"""'.replace('"""', '""')) || csv.includes('"Test ""quote"""'), detail: "RFC-4180 quoting" });

  return out;
}
