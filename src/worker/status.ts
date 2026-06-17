import { db } from "../lib/db.js";

const { data, error } = await db
  .from("research_jobs")
  .select("id, status, created_at")
  .order("created_at", { ascending: false })
  .limit(8);

if (error) { console.error(error); process.exit(1); }
for (const j of data ?? []) {
  console.log(j.status.padEnd(8), j.id, j.created_at);
}
