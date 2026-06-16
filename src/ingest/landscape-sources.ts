import Parser from "rss-parser";
import type { Scope } from "../scope.js";

export type Doc = {
  id: string;
  source: string;
  url: string;
  title: string;
  text: string;
  publishedAt?: string;
};

const UA = "market-intel-agents/0.1 (desk research)";
const parser = new Parser({ headers: { "User-Agent": UA }, timeout: 15000 });

// --- Competitor seed list — EDIT THIS ------------------------------------
type Competitor = { name: string; site?: string; feed?: string };
const COMPETITORS: Competitor[] = [
  // { name: "Acme Innovation", site: "https://www.example.com", feed: "https://www.example.com/blog/rss" },
];
// -------------------------------------------------------------------------

// --- Geographic focus: European editions + region-qualified queries ------
// `region` is AND-ed into every news query to bias the TOPIC toward Europe;
// hl/gl/ceid select a European Google News edition (US is omitted on purpose).
type Edition = { label: string; hl: string; gl: string; ceid: string; region: string };
const EUROPEAN_EDITIONS: Record<string, Edition> = {
  UK:      { label: "UK",      hl: "en-GB", gl: "GB", ceid: "GB:en", region: "(UK OR Europe)" },
  DACH:    { label: "DACH",    hl: "de",    gl: "DE", ceid: "DE:de", region: "(Germany OR Europe)" },
  Nordics: { label: "Nordics", hl: "sv",    gl: "SE", ceid: "SE:sv", region: "(Nordics OR Europe)" },
  Benelux: { label: "Benelux", hl: "nl",    gl: "NL", ceid: "NL:nl", region: "(Benelux OR Europe)" },
  EMEA:    { label: "EMEA",    hl: "en-GB", gl: "GB", ceid: "GB:en", region: "(Europe)" },
  Global:  { label: "Europe",  hl: "en-GB", gl: "GB", ceid: "GB:en", region: "(Europe)" },
};
const DEFAULT_EDITION: Edition = EUROPEAN_EDITIONS.UK;

function editionsFor(scope: Scope): Edition[] {
  const picks = (scope.geographies ?? [])
    .map((g) => EUROPEAN_EDITIONS[g])
    .filter((e): e is Edition => Boolean(e));
  const byCeid = new Map(picks.map((e) => [e.ceid, e]));
  return byCeid.size ? [...byCeid.values()] : [DEFAULT_EDITION];
}
// -------------------------------------------------------------------------

const PER_FEED = 6;
const MAX_DOCS = 50;

function googleNews(term: string, ed: Edition): string {
  const q = `${term} ${ed.region}`.trim();
  return (
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(`${q} when:30d`) +
    `&hl=${ed.hl}&gl=${ed.gl}&ceid=${ed.ceid}`
  );
}

async function parseFeed(url: string, source: string, limit: number): Promise<Doc[]> {
  try {
    const r = await parser.parseURL(url);
    return (r.items ?? []).slice(0, limit).map((item) => {
      const title = (item.title ?? "").trim();
      const snippet = (item.contentSnippet ?? item.content ?? "").replace(/\s+/g, " ").trim();
      return {
        id: "",
        source,
        url: item.link ?? "",
        title,
        text: snippet ? `${title} — ${snippet}` : title,
        publishedAt: item.isoDate,
      };
    });
  } catch {
    return []; // a dead feed must not sink the run
  }
}

async function scrapeSite(name: string, url: string, ms = 15000): Promise<Doc[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!res.ok) return [];
    const text = (await res.text())
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1500);
    return text ? [{ id: "", source: `competitor-site:${name}`, url, title: `${name} — site`, text }] : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function gatherLandscapeCorpus(scope: Scope): Promise<Doc[]> {
  const tasks: Promise<Doc[]>[] = [];
  const editions = editionsFor(scope);

  // 1. Scope-driven news — fanned out across European editions, region-qualified.
  const terms = [...new Set(
    [
      ...scope.verticals.map((v) => `${v} innovation`),
      scope.segment,
      "packaging innovation",
      "systematic innovation methodology",
    ]
      .filter((t): t is string => Boolean(t))
      .map((t) => t.trim()),
  )];
  for (const term of terms)
    for (const ed of editions)
      tasks.push(parseFeed(googleNews(term, ed), `news:${term} (${ed.label})`, PER_FEED));

  // 2. Competitor sources
  for (const c of COMPETITORS) {
    if (c.feed) tasks.push(parseFeed(c.feed, `competitor:${c.name}`, PER_FEED));
    if (c.site) tasks.push(scrapeSite(c.name, c.site));
    tasks.push(parseFeed(googleNews(`"${c.name}"`, editions[0]), `competitor-news:${c.name}`, 4));
  }

  // Fetch everything in parallel; merge, dedup, cap.
  const settled = await Promise.allSettled(tasks);
  const docs: Doc[] = [];
  const seen = new Set<string>();
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    for (const d of s.value) {
      const key = (d.url || d.title).toLowerCase();
      if (!d.title || seen.has(key)) continue;
      seen.add(key);
      d.id = `d${docs.length + 1}`;
      docs.push(d);
      if (docs.length >= MAX_DOCS) return docs;
    }
  }
  return docs;
}
