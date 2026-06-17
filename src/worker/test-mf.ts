import { runMarketFit } from "../agents/marketfit.js";
import type { Scope } from "../scope.js";
import type { Doc } from "../ingest/landscape-sources.js";

const scope = { message: "HR Tech Germany", geographies: ["DACH"] } as unknown as Scope;
const corpus: Doc[] = [
  { id: "d1", title: "Personio raises funding", source: "Handelsblatt", url: "https://x.de/1", text: "Personio, a Munich-based HR software company, raised new funding to expand across DACH." } as Doc,
];
const landscape = {
  competitors: [{ name: "Personio", archetype: "other", geography: "Germany", servicesOverlap: "HR SaaS" }],
  whiteSpace: ["SME onboarding automation"],
  marketSizing: { estimate: "€2B", confidence: "low", basis: "analyst estimate" },
  claims: [{ statement: "Personio is Munich-based", documentId: "d1", confidence: 0.9 }],
} as any;

try {
  const out = await runMarketFit(scope, corpus, landscape);
  console.log("SUCCESS — opportunities:", out.opportunities.length);
  console.log(JSON.stringify(out, null, 2).slice(0, 1500));
} catch (e) {
  console.error("FAILED:", e);
}
