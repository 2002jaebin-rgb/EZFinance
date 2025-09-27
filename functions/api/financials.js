// functions/api/financials.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const corpCode = url.searchParams.get("corp");
  const year = url.searchParams.get("year") || "2023";

  if (!corpCode) {
    return new Response(JSON.stringify({ error: "corp parameter required" }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  // OPENDART: 단일회사 요약 재무제표 (연간, 사업보고서: 11011)
  const apiUrl =
    `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json` +
    `?crtfc_key=${env.DART_API_KEY}` +
    `&corp_code=${corpCode}` +
    `&bsns_year=${year}` +
    `&reprt_code=11011`;

  try {
    const res = await fetch(apiUrl);
    const text = await res.text(); // DART가 가끔 text로 내려줄 수 있어 방어
    // JSON 파싱 시도
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "fetch failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
