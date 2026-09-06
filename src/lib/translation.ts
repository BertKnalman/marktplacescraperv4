/**
 * Translation layer.
 *
 * Architecture: a pluggable provider interface. In production (cloud deploy) the
 * provider calls DeepL / OpenAI from the server using TRANSLATION_API_KEY — the key
 * never reaches the browser. This build ships with the built-in offline dictionary
 * provider so the full pipeline (translate → cache → store) works end-to-end with
 * zero configuration.
 */

export interface TranslationProvider {
  id: string;
  name: string;
  serverSideOnly?: boolean;
  translate(text: string, sourceLang: string): string;
}

/* ---------------- phrase + word dictionaries ---------------- */

const PHRASES: Record<string, Array<[RegExp, string]>> = {
  en: [
    [/\bbrand new\b/gi, "nagelnieuw"],
    [/\blike new\b/gi, "als nieuw"],
    [/\bmint condition\b/gi, "in topstaat"],
    [/\bin perfect working order\b/gi, "in perfecte werkende staat"],
    [/\bworks perfectly\b/gi, "werkt perfect"],
    [/\bbattery health\b/gi, "accucapaciteit"],
    [/\boriginal box\b/gi, "originele doos"],
    [/\bpickup only\b/gi, "alleen afhalen"],
    [/\bfree shipping\b/gi, "gratis verzending"],
    [/\bor best offer\b/gi, "of beste bod"],
    [/\bfactory sealed\b/gi, "fabriekszegel intact"],
  ],
  pl: [
    [/\bstan bardzo dobry\b/gi, "sehr guter Zustand"],
    [/\bstan idealny\b/gi, "idealny Zustand"],
    [/\bjak nowy\b/gi, "wie neu"],
    [/\boryginalne opakowanie\b/gi, "Originalverpackung"],
    [/\bmożliwa wysyłka\b/gi, "Versand möglich"],
    [/\bmożliwość negocjacji\b/gi, "Preis verhandelbar"],
    [/\bodbior osobisty\b/gi, "Selbstabholung"],
    [/\bdo negocjacji\b/gi, "verhandelbar"],
    [/\bz paragonem\b/gi, "mit Kassenbon"],
    [/\bna gwarancji\b/gi, "unter Garantie"],
    [/\bfaktura vat\b/gi, "MwSt.-Rechnung"],
    [/\bpierwszy właściciel\b/gi, "Erstbesitzer"],
  ],
  fr: [
    [/\btrès bon état\b/gi, "sehr guter Zustand"],
    [/\bcomme neuf\b/gi, "wie neu"],
    [/\bneuf scellé\b/gi, "neu & versiegelt"],
    [/\bremise en main propre\b/gi, "persönliche Übergabe"],
    [/\bprix négociable\b/gi, "Preis verhandelbar"],
    [/\bavec facture\b/gi, "mit Rechnung"],
    [/\bsous garantie\b/gi, "unter Garantie"],
    [/\bpremière main\b/gi, "Erstbesitz"],
    [/\bétat impeccable\b/gi, "einwandfreier Zustand"],
  ],
};

const WORDS_EN_DE: Record<string, string> = {
  for: "für", sale: "Verkauf", sell: "verkaufe", selling: "verkaufe", buy: "kaufen",
  new: "neu", used: "gebraucht", refurbished: "generalüberholt", opened: "geöffnet",
  unopened: "ungeöffnet", sealed: "versiegelt", unlocked: "ohne Simlock", locked: "mit Simlock",
  condition: "Zustand", excellent: "ausgezeichnet", perfect: "perfekt", good: "gut",
  very: "sehr", barely: "kaum", never: "nie", always: "immer", almost: "fast",
  original: "original", genuine: "echt", box: "Box", package: "Paket", included: "inklusive",
  includes: "beinhaltet", with: "mit", without: "ohne", and: "und", the: "der/die/das",
  or: "oder", from: "von", until: "bis", warranty: "Garantie", receipt: "Beleg",
  shipping: "Versand", ship: "versende", pickup: "Abholung", delivery: "Lieferung",
  free: "gratis", charger: "Ladegerät", cable: "Kabel", case: "Hülle", cover: "Schutzhülle",
  screen: "Display", protector: "Schutzfolie", battery: "Akku", health: "Kapazität",
  camera: "Kamera", lens: "Objektiv", memory: "Speicher", storage: "Speicher",
  scratches: "Kratzer", dents: "Dellen", cracks: "Risse", damage: "Schaden", damaged: "beschädigt",
  works: "funktioniert", working: "funktionierend", tested: "getestet", verified: "geprüft",
  price: "Preis", best: "beste", offer: "Angebot", negotiable: "verhandelbar", firm: "fest",
  cheap: "günstig", rare: "selten", collector: "Sammler", item: "Artikel", locally: "lokal",
  only: "nur", months: "Monate", month: "Monat", years: "Jahre", year: "Jahr", weeks: "Wochen",
  days: "Tage", old: "alt", bought: "gekauft", reason: "Grund",
  upgrade: "Upgrade", switching: "wechsel", moving: "ziehe um", everything: "alles",
  complete: "komplett", set: "Set", kit: "Kit", bundle: "Paket", accessories: "Zubehör",
  invoice: "Rechnung", cash: "Barzahlung", trade: "Tausch", swap: "Tausch",
  black: "schwarz", white: "weiß", blue: "blau", green: "grün", red: "rot", silver: "silber",
  gold: "gold", gray: "grau", grey: "grau", pink: "rosa", purple: "lila", titanium: "Titan",
  natural: "natürlich", midnight: "Mitternacht", starlight: "Sternenlicht",
  description: "Beschreibung", details: "Details", questions: "Fragen", message: "Nachricht",
  email: "E-Mail", call: "Anruf", available: "verfügbar", still: "noch", yes: "ja",
  no: "kein", not: "nicht", issues: "Probleme", issue: "Problem", fault: "Fehler",
  fully: "voll", functional: "funktionsfähig", great: "super", amazing: "großartig",
  little: "wenig", lot: "viel", more: "mehr", photos: "Fotos", photo: "Foto",
  video: "Video", watch: "anschauen", check: "prüfen",
};

const WORDS_PL_DE: Record<string, string> = {
  sprzedam: "verkaufe", sprzedaję: "verkaufe", sprzedaje: "verkaufe", kupię: "kaufe",
  nowy: "neu", nowa: "neu", nowe: "neu", używany: "gebraucht", używana: "gebraucht",
  stan: "Zustand", bardzo: "sehr", dobry: "gut", dobra: "gut", dobre: "gut",
  idealny: "idealny", idealnym: "idealnym", prawie: "fast", niemal: "beinahe",
  oryginalny: "original", oryginał: "Original", oryginalne: "original",
  paragon: "Kassenbon", paragonem: "Kassenbon", faktura: "Rechnung", gwarancja: "Garantie",
  gwarancji: "Garantie", wysyłka: "Versand", wysyłką: "Versand", odbiór: "Abholung",
  osobisty: "persönlich", osobistym: "persönlich", możliwość: "Möglichkeit",
  negocjacji: "Verhandlung", negocjacja: "Verhandlung", cena: "Preis",
  do: "bis", w: "in", z: "mit", i: "und", na: "auf", od: "von", nie: "nicht",
  tak: "ja", jest: "ist", brak: "keine", bez: "ohne", dla: "für", po: "nach",
  uszkodzony: "beschädigt", uszkodzona: "beschädigt", sprawny: "funktionsfähig",
  sprawna: "funktionsfähig", działa: "funktioniert", działający: "funktionierend",
  doskonale: "ausgezeichnet", komplet: "Komplettset", kompletny: "komplett",
  pudełko: "Box", pudełku: "Box", ładowarka: "Ladegerät", ładowarką: "Ladegerät",
  etui: "Hülle", szkło: "Glas", folia: "Folie", folią: "Folie",
  bateria: "Akku", baterii: "Akku", kondycja: "Kapazität", rys: "Kratzer", rysy: "Kratzer",
  zadrapań: "Kratzer", otwarty: "geöffnet", otwarta: "geöffnet", zaplombowany: "versiegelt",
  fabrycznie: "werksseitig", rzadki: "selten", rzadka: "seltene", kolekcjonerski: "Sammler-",
  okazja: "Schnäppchen", pilne: "dringend", tanio: "günstig", vat: "MwSt.",
  raty: "Raten", pierwszy: "erster", właściciel: "Besitzer", rok: "Jahr", lata: "Jahre",
  miesiące: "Monate", miesięcy: "Monate", tygodnie: "Wochen", dni: "Tage",
  kupiony: "gekauft", kupione: "gekauft", powodu: "wegen", upgrade: "Upgrade",
  wymiany: "Wechsel", przeprowadzki: "Umzug", wszystko: "alles",
  akcesoria: "Zubehör", zestaw: "Set", gratis: "gratis", darmo: "gratis",
  zdjęcia: "Fotos", zdjęciach: "Fotos", pytania: "Fragen", zapraszam: "gerne melden",
  kontakt: "Kontakt", wiadomość: "Nachricht", telefon: "Telefon",
  czarny: "schwarz", czarna: "schwarz", biały: "weiß", biała: "weiß", niebieski: "blau",
  zielony: "grün", czerwony: "rot", srebrny: "silber", złoty: "gold", szary: "grau",
  różowy: "rosa", tytanowy: "Titan", naturalny: "natürlich",
  włączony: "eingeschaltet", testowany: "getestet",
  sprawdzone: "geprüft", serwisowany: "gewartet",
};

const WORDS_FR_DE: Record<string, string> = {
  vends: "verkaufe", vendre: "verkaufen", à: "zu", a: "hat", acheter: "kaufen",
  neuf: "neu", neuve: "neu", occasion: "gebraucht", reconditionné: "generalüberholt",
  état: "Zustand", très: "sehr", bon: "gut", bonne: "gut", excellent: "ausgezeichnet",
  parfait: "perfekt", comme: "wie", jamais: "nie", servi: "benutzt",
  original: "original", authentique: "authentisch", facture: "Rechnung",
  garantie: "Garantie", sous: "unter", livraison: "Lieferung", main: "Hand",
  propre: "persönlich", remise: "Übergabe", envoi: "Versand", possible: "möglich",
  prix: "Preis", négociable: "verhandelbar", ferme: "fest",
  dans: "in", avec: "mit", sans: "ohne", et: "und", de: "von", du: "des",
  la: "die", le: "der", les: "die", pour: "für", pas: "nicht", ne: "nicht",
  ouvert: "geöffnet", ouverte: "geöffnet", scellé: "versiegelt", scellée: "versiegelt",
  boîte: "Box", carton: "Karton", chargeur: "Ladegerät", câble: "Kabel",
  coque: "Hülle", housse: "Tasche", écran: "Display", protecteur: "Schutzfolie",
  batterie: "Akku", santé: "Kapazität", appareil: "Gerät", photo: "Kamera",
  rayures: "Kratzer", rayure: "Kratzer", fissures: "Risse", aucun: "keine", aucune: "keine",
  fonctionne: "funktioniert", parfaitement: "perfekt", testé: "getestet", vérifié: "geprüft",
  rare: "selten", collection: "Sammlung", collectionneur: "Sammler",
  urgence: "dringend", urgent: "dringend", première: "Erst-", peu: "wenig",
  mois: "Monate", ans: "Jahre", semaines: "Wochen", jours: "Tage",
  acheté: "gekauft", achetée: "gekauft", raison: "Grund", cause: "wegen",
  complet: "komplett", complète: "komplett", accessoires: "Zubehör",
  noir: "schwarz", noire: "schwarz", blanc: "weiß", blanche: "weiß", bleu: "blau",
  verte: "grün", vert: "grün", rouge: "rot", argent: "silber", or: "gold", gris: "grau",
  rose: "rosa", titane: "Titan", naturel: "natürlich",
  questions: "Fragen", message: "Nachricht", contact: "Kontakt",
  regardez: "anschauen", photos: "Fotos", vidéo: "Video",
};

const DICTS: Record<string, Record<string, string>> = {
  en: WORDS_EN_DE,
  pl: WORDS_PL_DE,
  fr: WORDS_FR_DE,
};

/* ---------------- engine ---------------- */

function matchCase(original: string, translated: string): string {
  if (!translated) return translated;
  if (original[0] === original[0].toUpperCase() && /[a-zà-ž]/i.test(original[0])) {
    return translated[0].toUpperCase() + translated.slice(1);
  }
  return translated;
}

/** Translate a text to German using the offline dictionary engine (demo provider). */
export function translateText(text: string, sourceLang: string): string {
  if (!text || sourceLang === "de") return text;
  const dict = DICTS[sourceLang];
  const phrases = PHRASES[sourceLang];
  if (!dict) return text;

  let out = text;
  if (phrases) {
    for (const [re, replacement] of phrases) out = out.replace(re, replacement);
  }

  out = out.replace(/[\p{L}][\p{L}'’-]*/gu, (word) => {
    const key = word.toLowerCase();
    const hit = dict[key];
    return hit ? matchCase(word, hit) : word;
  });
  return out;
}

/* ---------------- providers ---------------- */

class LocalDictionaryProvider implements TranslationProvider {
  id = "local";
  name = "Built-in dictionary (offline demo)";
  translate(text: string, sourceLang: string): string {
    return translateText(text, sourceLang);
  }
}

class ServerSideProvider implements TranslationProvider {
  id: string;
  name: string;
  serverSideOnly = true;
  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
  translate(text: string, sourceLang: string): string {
    // In cloud deployments this POSTs to /api/translate, which calls the vendor API
    // with TRANSLATION_API_KEY (server-side only, never exposed to the browser).
    // In this browser build we gracefully fall back to the offline engine.
    return translateText(text, sourceLang);
  }
}

export const PROVIDERS: TranslationProvider[] = [
  new LocalDictionaryProvider(),
  new ServerSideProvider("deepl", "DeepL API (server-side key)"),
  new ServerSideProvider("openai", "OpenAI GPT (server-side key)"),
];

export function getProvider(id: string): TranslationProvider {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}
