import type { Scope } from "../scope.js";

export type Doc = {
  id: string;
  source: string;
  url: string;
  title: string;
  text: string;
  publishedAt?: string;
};

// TODO: replace these stubs with the real source registry (docs/PLAN.md §3):
//   competitor sites + Clutch/G2, Bundesanzeiger/Companies House/SEC EDGAR filings,
//   EUR-Lex (PPWR/CSRD/ESPR), Lünendonk/Statista summaries, LinkedIn hiring signals,
//   CDP/SBTi, Glassdoor/Kununu, event programmes, targeted news.
// Honour robots.txt, throttle, set a real User-Agent, cache, and store provenance
// (source + url + fetched_at) on every Doc. Dedup by content hash.
export async function gatherLandscapeCorpus(scope: Scope): Promise<Doc[]> {
  void scope;
  // Placeholder corpus so the Landscape agent runs end-to-end before scrapers exist.
  return [
    {
      id: "doc-1",
      source: "competitor-site",
      url: "https://example.com/innovation-consulting",
      title: "Acme Innovation — systematic product innovation for FMCG",
      text:
        "Acme offers systematic innovation methodology and trainings for FMCG and packaging " +
        "clients across DACH. Recent case studies cite 25% CapEx reduction.",
      publishedAt: "2026-04-10",
    },
    {
      id: "doc-2",
      source: "clutch",
      url: "https://clutch.co/profile/beta-consulting",
      title: "Beta Consulting — design-and-build product innovation",
      text:
        "Beta Consulting is a design-and-build consultancy expanding from digital into " +
        "physical product innovation; ~40 staff; reviews mention strong delivery, high price.",
    },
  ];
}
