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

const buf = Buffer.from(await res.arrayBuffer());

// ZIP 여부는 시그니처로 판별
const isZip = buf.slice(0, 2).toString() === "PK";
if (!isZip) {
  console.error("❌ Response is not a zip file. First 500 chars:");
  console.error(buf.toString("utf-8").slice(0, 500));
  process.exit(1);
}

// 2) ZIP 해제 → 파일 목록 출력
const zip = new AdmZip(buf);
const entries = zip.getEntries();
console.log("📂 ZIP entries found:", entries.map(e => e.entryName));

const xmlEntry = entries.find(e => e.entryName.toUpperCase().endsWith(".XML"));
if (!xmlEntry) {
  console.error("❌ No XML file found inside zip.");
  process.exit(1);
}
const xml = xmlEntry.getData().toString("utf-8");
console.log("ℹ️ First 300 chars of XML:", xml.slice(0, 300));

// 3) XML 파싱
const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
const parsed = parser.parse(xml);
console.log("🔎 Parsed root keys:", Object.keys(parsed));

const lists = parsed?.result?.list;
if (!lists) {
  console.error("❌ parsed.result.list not found. Full root:", JSON.stringify(parsed, null, 2).slice(0, 1000));
  process.exit(1);
}

const arr = Array.isArray(lists) ? lists : [lists];
console.log(`📊 Parsed list count: ${arr.length}`);
console.log("🔎 Sample row:", arr[0]);

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

console.log(`✅ Final rows ready: ${rows.length}`);
if (rows.length > 0) {
  console.log("🔎 Sample rows:", rows.slice(0, 3));
}

// 4) Supabase 업서트
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
