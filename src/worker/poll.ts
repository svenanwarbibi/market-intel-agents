// Watches Supabase for queued jobs and runs the full pipeline on each.
// Run with: npm run poll
import "dotenv/config";
import { db } from "../lib/db.js";
import { parseScope } from "../scope.js";
import { gatherLandscapeCorpus } from "../ingest/landscape-sources.js";
import { runLandscape } from "../agents/landscape.js";
import { runMarketFit } from "../agents/marketfit.js";
import { MODELS } from "../lib/anthropic.js";
import { persistDocuments, persistChapter, finishJob } from "../lib/persist.js";
import { buildReportXlsx } from "../lib/report.js";
import { sendReportEmail } from "../lib/email.js";

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

  // Chapter 6 — IC-3 Market-Fit (best-effort; a failure must not lose the landscape).
  let marketfit: any = undefined;
  try {
    marketfit = await runMarketFit(scope, corpus, landscape);
    await persistChapter(job.id, 6, marketfit, MODELS.chapter, [], docIdMap);
    console.log(`  + Market-Fit: ${marketfit.opportunities.length} opportunities.`);
  } catch (e) {
    console.error("  Market-Fit step failed (landscape kept):", e);
  }

  await finishJob(job.id, "done");
  console.log(`✓ Job ${job.id} done — ${corpus.length} docs.`);

  // Email the full results as an Excel workbook (best-effort).
  try {
    const xlsx = await buildReportXlsx({ scope, corpus, landscape, marketfit });
    const title = (scope as any).verticals?.join(", ") || message || "Research run";
    const sent = await sendReportEmail({
      to: globalThis.process.env.REPORT_EMAIL ?? "svenabibi@gmail.com",
      subject: `Market-Intel report: ${title}`,
      text:
        `Attached: full results for "${title}".\n\n` +
        `Geographies: ${((scope as any).geographies ?? []).join(", ")}\n` +
        `Opportunities: ${marketfit?.opportunities?.length ?? 0}\n` +
        `Job id: ${job.id}`,
      filename: `market-intel-${job.id.slice(0, 8)}.xlsx`,
      xlsx,
    });
    if (sent) console.log("  Report emailed.");
  } catch (e) {
    console.error("  Email step failed (results kept):", e);
  }
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
