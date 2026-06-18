import { db } from "../lib/db.js";
import { runLandscape } from "../agents/landscape.js";
import type { Doc } from "../ingest/landscape-sources.js";

const jobId = process.argv[2];
if (!jobId) { console.error("usage: run-landscape-on-job <jobId>"); process.exit(1); }
const { data: job } = await db.from("research_jobs").select("scope").eq("id", jobId).single();
const { data: docs } = await db.from("documents")
  .select("url, title, source, raw_text, published_at").eq("job_id", jobId);
const corpus: Doc[] = (docs ?? []).map((d: any, i: number) => ({
  id: `d${i + 1}`, url: d.url, title: d.title, source: d.source, text: d.raw_text, publishedAt: d.published_at,
}));
console.error(">>> docs:", corpus.length, "— running landscape (may take 1-2 min)…");
try {
  const out = await runLandscape(job!.scope, corpus);
  console.error(">>> SUCCESS — competitors:", out.competitors.length, "claims:", out.claims.length);
} catch (e) {
  console.error(">>> FAILED:", e);
}
