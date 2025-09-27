import fetch from "node-fetch";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DART_API_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DART_API_KEY) {
  console.error("Missing env vars");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 1) CORPCODE.zip 가져오기
const zipUrl = `https://opendart.fss.or.kr/api/corpCode.zip?crtfc_key=${DART_API_KEY}`;
console.log("Downloading:", zipUrl);
const res = await fetch(zipUrl);
if (!res.ok) {
  console.error("Failed to download zip:", res.status, await res.text());
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());

// 2) ZIP 해제 → XML 추출
const zip = new AdmZip(buf);
const xmlEntry = zip.getEntries().find(e => e.entryName.toLowerCase().endsWith(".xml"));
if (!xmlEntry) {
  console.error("No XML in zip");
  process.exit(1);
}
const xml = xmlEntry.getData().toString("utf-8");

// 3) XML 파싱
const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  textNodeName: "#text"
});
const parsed = parser.parse(xml);
const lists = parsed?.result?.list;
const arr = Array.isArray(lists) ? lists : [lists];

function getText(node) {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "object" && "#text" in node) return node["#text"];
  return "";
}

const rows = arr.map(x => ({
  corp_code: getText(x.corp_code).trim(),
  stock_code: getText(x.stock_code).trim() || null,
  name: getText(x.corp_name).trim()
})).filter(r => r.corp_code && r.name);


// 4) 배치 업서트
console.log(`Upserting ${rows.length} rows...`);
for (let i = 0; i < rows.length; i += 1000) {
  const chunk = rows.slice(i, i + 1000);
  const { error } = await sb.from("corpmap")
    .upsert(chunk, { onConflict: "corp_code" });
  if (error) {
    console.error("Upsert error:", error);
    process.exit(1);
  }
  console.log(`Upserted ${Math.min(i + 1000, rows.length)}/${rows.length}`);
}
console.log("Done.");
