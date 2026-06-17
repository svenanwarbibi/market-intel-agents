import { db } from "../lib/db.js";

const jobId = "133714dd-282b-4981-9d44-0edd12ddfe14";
const { data, error } = await db
  .from("chapter_outputs")
  .select("chapter, created_at")
  .eq("job_id", jobId)
  .order("chapter");

if (error) { console.error(error); process.exit(1); }
console.log("Chapters for", jobId, ":");
for (const c of data ?? []) console.log("  chapter", c.chapter, "-", c.created_at);
if (!data?.some((c) => c.chapter === 6)) console.log("  No Chapter 6 (Market-Fit) persisted.");
