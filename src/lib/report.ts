import ExcelJS from "exceljs";

// Builds a comprehensive .xlsx workbook capturing the ENTIRE run outcome.
export async function buildReportXlsx(args: {
  scope: any;
  corpus: any[];
  landscape: any;
  marketfit?: any;
}): Promise<Buffer> {
  const { scope, corpus, landscape, marketfit } = args;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Market Intel";
  wb.created = new Date();

  const docById = new Map((corpus ?? []).map((d: any) => [d.id, d]));
  const header = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0ECE4" } };
    ws.views = [{ state: "frozen", ySplit: 1 }]; ws.eachRow((r: any) => r.eachCell((cell: any) => { cell.alignment = { vertical: "top", wrapText: true }; }));
  };
  const wrap = (ws: ExcelJS.Worksheet, keys: string[]) => {
    for (const k of keys) ws.getColumn(k).alignment = { wrapText: true, vertical: "top" };
  };

  // ── Summary ───────────────────────────────────────────────────────────────
  const sum = wb.addWorksheet("Summary");
  sum.columns = [{ header: "Field", key: "k", width: 26 }, { header: "Value", key: "v", width: 100 }];
  sum.addRow({ k: "Vertical(s)", v: (scope?.verticals ?? []).join(", ") || scope?.message || "" });
  sum.addRow({ k: "Segment", v: scope?.segment ?? "" });
  sum.addRow({ k: "Geographies", v: (scope?.geographies ?? []).join(", ") });
  sum.addRow({ k: "Time horizon", v: scope?.timeHorizon ?? "" });
  sum.addRow({ k: "Generated", v: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC" });
  sum.addRow({ k: "Competitors found", v: (landscape?.competitors ?? []).length });
  sum.addRow({ k: "Sources", v: (corpus ?? []).length });
  sum.addRow({ k: "Opportunities", v: (marketfit?.opportunities ?? []).length });
  sum.addRow({ k: "", v: "" });
  if (landscape?.marketSizing) {
    sum.addRow({ k: "Market sizing", v: landscape.marketSizing.estimate });
    sum.addRow({ k: "Sizing confidence", v: landscape.marketSizing.confidence });
  }
  if (marketfit?.executiveSummary) {
    sum.addRow({ k: "", v: "" });
    sum.addRow({ k: "Market-Fit summary", v: marketfit.executiveSummary });
  }
  if (marketfit?.lowHangingFruitList?.length)
    sum.addRow({ k: "Low-hanging fruit", v: marketfit.lowHangingFruitList.join("; ") });
  wrap(sum, ["v"]);
  header(sum);

  // ── Competitors ─────────────────────────────────────────────────────────────
  const comp = wb.addWorksheet("Competitors");
  comp.columns = [
    { header: "#", key: "n", width: 5 },
    { header: "Name", key: "name", width: 30 },
    { header: "Archetype", key: "arch", width: 24 },
    { header: "Geography", key: "geo", width: 20 },
    { header: "Services overlap", key: "ov", width: 55 },
    { header: "Financial trajectory", key: "fin", width: 45 },
  ];
  (landscape?.competitors ?? []).forEach((c: any, i: number) =>
    comp.addRow({ n: i + 1, name: c.name, arch: c.archetype, geo: c.geography, ov: c.servicesOverlap, fin: c.financialTrajectory ?? "" }));
  wrap(comp, ["ov", "fin"]);
  header(comp);

  // ── White Space ───────────────────────────────────────────────────────────
  const wsp = wb.addWorksheet("White Space");
  wsp.columns = [{ header: "#", key: "n", width: 5 }, { header: "Opportunity", key: "w", width: 110 }];
  (landscape?.whiteSpace ?? []).forEach((w: string, i: number) => wsp.addRow({ n: i + 1, w }));
  wrap(wsp, ["w"]);
  header(wsp);

  // ── Market Sizing ───────────────────────────────────────────────────────────
  const ms = wb.addWorksheet("Market Sizing");
  ms.columns = [{ header: "Field", key: "k", width: 20 }, { header: "Value", key: "v", width: 110 }];
  if (landscape?.marketSizing) {
    ms.addRow({ k: "Estimate", v: landscape.marketSizing.estimate });
    ms.addRow({ k: "Confidence", v: landscape.marketSizing.confidence });
    ms.addRow({ k: "Basis", v: landscape.marketSizing.basis });
  }
  wrap(ms, ["v"]);
  header(ms);

  // ── Evidence (claims, with resolved sources) ─────────────────────────────────
  const ev = wb.addWorksheet("Evidence");
  ev.columns = [
    { header: "Statement", key: "s", width: 80 },
    { header: "Confidence", key: "c", width: 12 },
    { header: "Source", key: "src", width: 35 },
    { header: "URL", key: "u", width: 55 },
  ];
  (landscape?.claims ?? []).forEach((cl: any) => {
    const doc: any = docById.get(cl.documentId);
    ev.addRow({
      s: cl.statement,
      c: cl.confidence != null ? Math.round(cl.confidence * 100) + "%" : "",
      src: doc ? (doc.title || doc.source) : cl.documentId,
      u: doc?.url ?? "",
    });
  });
  wrap(ev, ["s", "src", "u"]);
  header(ev);

  // ── Sources (with full text) ─────────────────────────────────────────────────
  const src = wb.addWorksheet("Sources");
  src.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Title", key: "t", width: 50 },
    { header: "Source", key: "s", width: 28 },
    { header: "URL", key: "u", width: 50 },
    { header: "Published", key: "p", width: 14 },
    { header: "Text", key: "x", width: 90 },
  ];
  (corpus ?? []).forEach((d: any) =>
    src.addRow({ id: d.id, t: d.title, s: d.source, u: d.url, p: d.publishedAt ? String(d.publishedAt).slice(0, 10) : "", x: d.text ?? "" }));
  wrap(src, ["t", "u", "x"]);
  header(src);

  // ── Opportunities (full Market-Fit detail) ───────────────────────────────────
  const opp = wb.addWorksheet("Opportunities");
  opp.columns = [
    { header: "Organisation", key: "org", width: 26 },
    { header: "Geography", key: "geo", width: 18 },
    { header: "EU", key: "eu", width: 6 },
    { header: "Low-hanging", key: "lhf", width: 12 },
    { header: "Signals", key: "sgn", width: 50 },
    { header: "Offering", key: "off", width: 38 },
    { header: "Signal", key: "sig", width: 9 },
    { header: "Fit", key: "fit", width: 8 },
    { header: "Engage", key: "eng", width: 9 },
    { header: "Geo x", key: "gw", width: 8 },
    { header: "Recency", key: "rec", width: 9 },
    { header: "Composite", key: "comp", width: 11 },
    { header: "Rationale", key: "rat", width: 60 },
    { header: "Conversation starter", key: "cs", width: 60 },
  ];
  (marketfit?.opportunities ?? []).forEach((o: any) => {
    const offs = o.matchedOfferings ?? [];
    const signals = (o.signals ?? []).join(" | ");
    if (offs.length === 0) {
      opp.addRow({ org: o.organisation, geo: o.geography, eu: o.isEU ? "yes" : "no", lhf: o.lowHangingFruit ? "yes" : "", sgn: signals, cs: o.conversationStarter });
    }
    offs.forEach((m: any, i: number) =>
      opp.addRow({
        org: i === 0 ? o.organisation : "",
        geo: i === 0 ? o.geography : "",
        eu: i === 0 ? (o.isEU ? "yes" : "no") : "",
        lhf: i === 0 ? (o.lowHangingFruit ? "yes" : "") : "",
        sgn: i === 0 ? signals : "",
        off: m.offeringName,
        sig: m.signalStrength,
        fit: m.offeringFit,
        eng: m.engagementLikelihood,
        gw: m.geographicWeight,
        rec: m.recencyBonus,
        comp: m.composite,
        rat: m.rationale ?? "",
        cs: i === 0 ? o.conversationStarter : "",
      }));
  });
  wrap(opp, ["sgn", "rat", "cs"]);
  header(opp);

  // ── Offering Heat Map ─────────────────────────────────────────────────────────
  const heat = wb.addWorksheet("Heat Map");
  heat.columns = [
    { header: "Offering", key: "o", width: 45 },
    { header: "Opportunities", key: "n", width: 16 },
    { header: "Avg composite", key: "a", width: 16 },
  ];
  (marketfit?.offeringHeatMap ?? [])
    .slice()
    .sort((a: any, b: any) => (b.opportunityCount ?? 0) - (a.opportunityCount ?? 0))
    .forEach((h: any) => heat.addRow({ o: h.offeringName, n: h.opportunityCount, a: h.avgComposite }));
  header(heat);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as any);
}
