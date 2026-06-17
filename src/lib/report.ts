import ExcelJS from "exceljs";

// Builds an .xlsx workbook with every section of a completed run.
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

  const header = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0ECE4" } };
  };

  const sum = wb.addWorksheet("Summary");
  sum.columns = [{ header: "Field", key: "k", width: 28 }, { header: "Value", key: "v", width: 90 }];
  sum.addRow({ k: "Scope", v: (scope?.verticals ?? []).join(", ") || scope?.message || "" });
  sum.addRow({ k: "Geographies", v: (scope?.geographies ?? []).join(", ") });
  sum.addRow({ k: "Horizon", v: scope?.horizon ?? "" });
  if (landscape?.marketSizing) {
    sum.addRow({ k: "Market sizing", v: landscape.marketSizing.estimate });
    sum.addRow({ k: "Sizing confidence", v: landscape.marketSizing.confidence });
    sum.addRow({ k: "Sizing basis", v: landscape.marketSizing.basis });
  }
  if (marketfit?.executiveSummary) sum.addRow({ k: "Market-Fit summary", v: marketfit.executiveSummary });
  if (marketfit?.lowHangingFruitList?.length)
    sum.addRow({ k: "Low-hanging fruit", v: marketfit.lowHangingFruitList.join("; ") });
  header(sum);

  const comp = wb.addWorksheet("Competitors");
  comp.columns = [
    { header: "Name", key: "name", width: 30 },
    { header: "Archetype", key: "arch", width: 24 },
    { header: "Geography", key: "geo", width: 20 },
    { header: "Services overlap", key: "ov", width: 50 },
    { header: "Financial trajectory", key: "fin", width: 40 },
  ];
  for (const c of landscape?.competitors ?? [])
    comp.addRow({ name: c.name, arch: c.archetype, geo: c.geography, ov: c.servicesOverlap, fin: c.financialTrajectory ?? "" });
  header(comp);

  const wsp = wb.addWorksheet("White Space");
  wsp.columns = [{ header: "Opportunity", key: "w", width: 90 }];
  for (const w of landscape?.whiteSpace ?? []) wsp.addRow({ w });
  header(wsp);

  const ev = wb.addWorksheet("Evidence");
  ev.columns = [
    { header: "Statement", key: "s", width: 80 },
    { header: "Confidence", key: "c", width: 14 },
    { header: "Source id", key: "d", width: 16 },
  ];
  for (const cl of landscape?.claims ?? [])
    ev.addRow({ s: cl.statement, c: cl.confidence, d: cl.documentId });
  header(ev);

  const src = wb.addWorksheet("Sources");
  src.columns = [
    { header: "Title", key: "t", width: 50 },
    { header: "Source", key: "s", width: 24 },
    { header: "URL", key: "u", width: 60 },
    { header: "Published", key: "p", width: 16 },
  ];
  for (const d of corpus ?? [])
    src.addRow({ t: d.title, s: d.source, u: d.url, p: d.publishedAt ?? "" });
  header(src);

  const opp = wb.addWorksheet("Opportunities");
  opp.columns = [
    { header: "Organisation", key: "org", width: 28 },
    { header: "Geography", key: "geo", width: 20 },
    { header: "EU", key: "eu", width: 8 },
    { header: "Low-hanging", key: "lhf", width: 12 },
    { header: "Offering", key: "off", width: 40 },
    { header: "Signal", key: "sig", width: 10 },
    { header: "Fit", key: "fit", width: 8 },
    { header: "Engage", key: "eng", width: 10 },
    { header: "Geo x", key: "gw", width: 8 },
    { header: "Composite", key: "comp", width: 12 },
    { header: "Conversation starter", key: "cs", width: 60 },
  ];
  for (const o of marketfit?.opportunities ?? []) {
    const offs = o.matchedOfferings ?? [];
    if (offs.length === 0) {
      opp.addRow({ org: o.organisation, geo: o.geography, eu: o.isEU ? "yes" : "no", lhf: o.lowHangingFruit ? "yes" : "", cs: o.conversationStarter });
    }
    offs.forEach((m: any, i: number) => {
      opp.addRow({
        org: i === 0 ? o.organisation : "",
        geo: i === 0 ? o.geography : "",
        eu: i === 0 ? (o.isEU ? "yes" : "no") : "",
        lhf: i === 0 ? (o.lowHangingFruit ? "yes" : "") : "",
        off: m.offeringName,
        sig: m.signalStrength,
        fit: m.offeringFit,
        eng: m.engagementLikelihood,
        gw: m.geographicWeight,
        comp: m.composite,
        cs: i === 0 ? o.conversationStarter : "",
      });
    });
  }
  header(opp);

  const heat = wb.addWorksheet("Heat Map");
  heat.columns = [
    { header: "Offering", key: "o", width: 45 },
    { header: "Opportunities", key: "n", width: 16 },
    { header: "Avg composite", key: "a", width: 16 },
  ];
  for (const h of marketfit?.offeringHeatMap ?? [])
    heat.addRow({ o: h.offeringName, n: h.opportunityCount, a: h.avgComposite });
  header(heat);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as any);
}
