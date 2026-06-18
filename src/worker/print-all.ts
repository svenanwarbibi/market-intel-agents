import { db } from "../lib/db.js";
const { data, error } = await db
  .from("research_jobs").select("id, scope, status, created_at").order("created_at", { ascending: false });
if (error) { console.error(error); process.exit(1); }
console.log("TOTAL jobs:", data?.length);
(data ?? []).slice(0, 6).forEach((j: any, i: number) => {
  const s = typeof j.scope === "string" ? JSON.parse(j.scope) : j.scope ?? {};
  const label = (s.verticals ?? []).join(", ") || s.message || "(request)";
  console.log(`#${i}`, j.created_at.slice(0, 19), j.status.padEnd(7), label.slice(0, 50));
});
