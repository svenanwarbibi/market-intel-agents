import { db } from "../lib/db.js";
const { data } = await db.from("research_jobs")
  .select("id, scope, status, created_at").order("created_at", { ascending: false }).limit(12);
for (const j of data ?? []) {
  const s = typeof j.scope === "string" ? JSON.parse(j.scope) : j.scope ?? {};
  const label = (s.verticals ?? []).join(", ") || s.message || "(request)";
  console.log(j.status.padEnd(7), j.created_at.slice(0, 19), "|", label.slice(0, 70));
}
