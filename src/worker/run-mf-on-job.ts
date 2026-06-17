import { db } from "../lib/db.js";
import { runMarketFit } from "../agents/marketfit.js";
import type { Doc } from "../ingest/landscape-sources.js";

const jobId = process.argv[2];
if (!jobId) { console.error("usage: run-mf-on-job <jobId>"); process.exit(1); }

const { data: job } = await db.from("research_jobs").select("scope").eq("id", jobId).single();
const scope = job?.scope ?? { message: "unknown" };

const { data: ch } = await db
  .from("chapter_outputs").select("payload").eq("job_id", jobId).eq("chapter", 1).single();
const landscape = ch?.payload as any;

const { data: docs } = await db
  .from("documents").select("id, url, title, source, raw_text, published_at").eq("job_id", jobId);
const corpus: Doc[] = (docs ?? []).map((d: any) => ({
  id: d.id, url: d.url, title: d.title, source: d.source, text: d.raw_text, publishedAt: d.published_at,
}));

console.error(`>>> job ${jobId}: ${corpus.length} docs, landscape ${landscape ? "ok" : "MISSING"}`);
console.error(">>> running Market-Fit (foreground)…");
const t0 = Date.now();
try {
  const out = await runMarketFit(scope, corpus, landscape);
  console.error(`>>> SUCCESS in ${((Date.now()-t0)/1000).toFixed(0)}s — ${out.opportunities.length} opportunities`);
  console.log(out.executiveSummary);
} catch (e) {
  console.error(`>>> FAILED after ${((Date.now()-t0)/1000).toFixed(0)}s:`, e);
}
