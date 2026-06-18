import { db } from "../lib/db.js";
const { data: jobs } = await db.from("research_jobs")
  .select("id, scope, created_at").order("created_at", { ascending: false }).limit(1);
const job = jobs?.[0];
console.log("JOB:", job?.id);
console.log("SCOPE:", JSON.stringify(job?.scope, null, 2));
const { data: docs } = await db.from("documents").select("title, source, url").eq("job_id", job!.id);
console.log("DOCS:", docs?.length);
(docs ?? []).forEach((d: any) => console.log("  -", d.source, "|", (d.title ?? "").slice(0, 70)));
