// M3 + persistence: parse → ingest → run Landscape → SAVE to Supabase.
import { parseScope } from "../scope.js";
import { gatherLandscapeCorpus } from "../ingest/landscape-sources.js";
import { runLandscape } from "../agents/landscape.js";
import { MODELS } from "../lib/anthropic.js";
import { createJob, persistDocuments, persistChapter, finishJob } from "../lib/persist.js";

const message =
  process.argv.slice(2).join(" ") ||
  "Analyze systematic-innovation consulting for FMCG and packaging in DACH, near-term";

const scope = await parseScope(message);
console.log("Resolved scope:\n", scope, "\n");

const jobId = await createJob(scope);
console.log("Job created:", jobId);

try {
  const corpus = await gatherLandscapeCorpus(scope);
  console.log(`Ingested ${corpus.length} documents.`);
  const docIdMap = await persistDocuments(jobId, corpus);

  const landscape = await runLandscape(scope, corpus);
  await persistChapter(jobId, 1, landscape, MODELS.chapter, landscape.claims, docIdMap);
  await finishJob(jobId, "done");

  console.log(`\nSaved to Supabase. Job ${jobId} → done.`);
  console.log(JSON.stringify(landscape, null, 2));
} catch (e) {
  await finishJob(jobId, "failed");
  throw e;
}