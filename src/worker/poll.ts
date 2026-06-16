// Watches Supabase for queued jobs and runs the full pipeline on each.
// Run with: npm run poll
import { db } from "../lib/db.js";
import { parseScope } from "../scope.js";
import { gatherLandscapeCorpus } from "../ingest/landscape-sources.js";
import { runLandscape } from "../agents/landscape.js";
import { MODELS } from "../lib/anthropic.js";
import { persistDocuments, persistChapter, finishJob } from "../lib/persist.js";

const POLL_MS = 5000;

async function claimNext(): Promise<{ id: string; scope: any } | null> {
  const { data } = await db
    .from("research_jobs")
    .select("id, scope")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);
  const job = data?.[0];
  if (!job) return null;
  const { data: claimed } = await db
    .from("research_jobs")
    .update({ status: "running" })
    .eq("id", job.id)
    .eq("status", "queued")
    .select("id, scope");
  return claimed && claimed.length ? (claimed[0] as any) : null;
}

async function process(job: { id: string; scope: any }) {
  const raw = typeof job.scope === "string" ? JSON.parse(job.scope) : job.scope;
  const message = raw?.message ?? "Analyze the market";
  const scope = await parseScope(message);
  await db.from("research_jobs").update({ scope }).eq("id", job.id);

  const corpus = await gatherLandscapeCorpus(scope);
  const docIdMap = await persistDocuments(job.id, corpus);
  const landscape = await runLandscape(scope, corpus);
  await persistChapter(job.id, 1, landscape, MODELS.chapter, landscape.claims, docIdMap);
  await finishJob(job.id, "done");
  console.log(`✓ Job ${job.id} done — ${corpus.length} docs.`);
}

console.log("Poller running. Watching for queued jobs… (Ctrl-C to stop)");
for (;;) {
  try {
    const job = await claimNext();
    if (job) {
      console.log(`→ Processing ${job.id} …`);
      try {
        await process(job);
      } catch (e) {
        console.error("Job failed:", e);
        await finishJob(job.id, "failed");
      }
    } else {
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  } catch (e) {
    console.error("Poller error:", e);
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}
