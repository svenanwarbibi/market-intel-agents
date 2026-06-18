import { db } from "../lib/db.js";
const { data: jobs } = await db.from("research_jobs")
  .select("id, scope, status, created_at").order("created_at", { ascending: false }).limit(1);
const job = jobs?.[0];
if (!job) { console.log("no jobs"); process.exit(0); }
const s = typeof job.scope === "string" ? JSON.parse(job.scope) : job.scope ?? {};
console.log("Latest job:", job.id, "|", (s.verticals ?? []).join(",") || s.message, "| status:", job.status);
const { data: chs } = await db.from("chapter_outputs")
  .select("chapter, created_at").eq("job_id", job.id).order("chapter");
console.log("Chapters present:", (chs ?? []).map((c: any) => c.chapter).join(", ") || "none");
