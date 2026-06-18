import { db } from "../lib/db.js";
import { runMarketFit } from "../agents/marketfit.js";
import { persistChapter } from "../lib/persist.js";
import { MODELS } from "../lib/anthropic.js";
import type { Doc } from "../ingest/landscape-sources.js";

const jobId = process.argv[2];
if (!jobId) { console.error("usage: repair-mf <jobId>"); process.exit(1); }

const { data: job } = await db.from("research_jobs").select("scope").eq("id", jobId).single();
const scope = job?.scope ?? {};
const { data: ch1 } = await db.from("chapter_outputs").select("payload").eq("job_id", jobId).eq("chapter", 1).single();
if (!ch1?.payload) { console.error("no chapter 1 for this job"); process.exit(1); }
const { data: existing } = await db.from("chapter_outputs").select("id").eq("job_id", jobId).eq("chapter", 6);
if (existing?.length) { console.log("Chapter 6 already exists; nothing to do."); process.exit(0); }

const { data: docs } = await db.from("documents").select("id, url, title, source, raw_text, published_at").eq("job_id", jobId);
const corpus: Doc[] = (docs ?? []).map((d: any) => ({ id: d.id, url: d.url, title: d.title, source: d.source, text: d.raw_text, publishedAt: d.published_at }));

console.log("Running Market-Fit for", jobId, "…");
const mf = await runMarketFit(scope, corpus, ch1.payload);
await persistChapter(jobId, 6, mf, MODELS.chapter, [], new Map());
console.log("Chapter 6 persisted:", mf.opportunities.length, "opportunities.");
