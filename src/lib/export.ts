/** Client-side export: CSV (RFC-4180, UTF-8 BOM for Excel) and JSON. */

import type { Listing } from "../types";
import { csvEscape, downloadFile } from "./util";
import { logExport } from "./db";

const CSV_COLUMNS: Array<[string, (l: Listing) => string | number | undefined]> = [
  ["marketplace", (l) => l.marketplace],
  ["marketplace_listing_id", (l) => l.marketplace_listing_id],
  ["url", (l) => l.url],
  ["title_original", (l) => l.title_original],
  ["title_german", (l) => l.title_german],
  ["description_original", (l) => l.description_original],
  ["description_german", (l) => l.description_german],
  ["price", (l) => l.price],
  ["currency", (l) => l.currency],
  ["price_original", (l) => l.price_original],
  ["location", (l) => l.location],
  ["published_at", (l) => l.published_at],
  ["source_lang", (l) => l.source_lang],
  ["first_seen", (l) => l.first_seen],
  ["last_seen", (l) => l.last_seen],
  ["images", (l) => l.images.join(" | ")],
];

export function listingsToCsv(rows: Listing[]): string {
  const header = CSV_COLUMNS.map(([name]) => name).join(",");
  const body = rows
    .map((l) => CSV_COLUMNS.map(([, getter]) => csvEscape(getter(l))).join(","))
    .join("\r\n");
  return "\uFEFF" + header + "\r\n" + body + "\r\n";
}

export function listingsToJson(rows: Listing[]): string {
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      count: rows.length,
      listings: rows,
    },
    null,
    2,
  );
}

export function exportListings(
  userId: string,
  rows: Listing[],
  format: "csv" | "json",
  label: string,
): { filename: string; count: number } {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const safe = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32) || "listings";
  const filename = `marketplace-scraper_${safe}_${stamp}.${format}`;
  const content = format === "csv" ? listingsToCsv(rows) : listingsToJson(rows);
  downloadFile(filename, content, format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8");
  logExport(userId, format, rows.length, filename);
  return { filename, count: rows.length };
}
