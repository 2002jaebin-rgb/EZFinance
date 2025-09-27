import fetch from "node-fetch";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DART_API_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DART_API_KEY) {
  console.error("❌ Missing env vars: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DART_API_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 1) CORPCODE.zip 다운로드
const zipUrl = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${DART_API_KEY}`;
console.log("📥 Downloading:", zipUrl);

const res = await fetch(zipUrl);
if (!res.ok) {
  console.error("❌ Failed to download:", res.status, await res.text());
  process.exit(1);
}

const ct = res.headers.get("content-type") || "";
console.log("ℹ️ Content-Type:", ct);

const buf = Buffer.from(await res.arrayBuffer());

// 2) 응답이 ZIP이 맞는지 확인
if (!ct.includes("zip") && !ct.includes("octet-stream")) {
  console.error("❌ Response is not a zip file. First 500 chars:");
  console.error(buf.toString("utf-8").slice(0, 500));
  process.exit(1);
}

// 3) ZIP 해제 → XML 추출
const zip = new AdmZip(buf);
const xmlEntry = zip.getEntries().find(e => e.entryName.toLowerCase().endsWith(".xml"));
if (!xmlEntry) {
  console.error("❌ No XML file found inside zip.");
  process.exit(1);
}
const xml = xmlEntry.getData().toString("utf-8");

// 4) XML 파싱
const parser = new XMLParser({ ignoreAttributes: false, trimValues: true, textNodeName: "#text" });
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

console.log(`📊 Parsed rows: ${rows.length}`);
if (rows.length > 0) {
  console.log("🔎 Sample:", rows.slice(0, 3));
}

// 5) Supabase 업서트
if (rows.length === 0) {
  console.error("❌ No rows to upsert. Stopping.");
  process.exit(1);
}

console.log(`⬆️ Upserting ${rows.length} rows...`);
const BATCH = 1000;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const { error } = await sb.from("corpmap")
    .upsert(chunk, { onConflict: "corp_code" });
  if (error) {
    console.error("❌ Upsert error:", error);
    process.exit(1);
  }
  console.log(`✅ Upserted ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
}

console.log("🎉 Done.");
