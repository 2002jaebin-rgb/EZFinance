// functions/api/financials.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const corpCode = url.searchParams.get("corp");
  const year = url.searchParams.get("year") || "2023";
  // 사용자가 쿼리로 fs_div를 넘기면 우선, 없으면 CFS 기본
  const fsDivFromQuery = url.searchParams.get("fs_div");
  const fsCandidates = fsDivFromQuery ? [fsDivFromQuery] : ["CFS", "OFS"]; // CFS 우선, 실패시 OFS

  if (!corpCode) {
    return new Response(JSON.stringify({ error: "corp parameter required" }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const commonHeaders = {
    "User-Agent":
      "Mozilla/5.0 (compatible; EZFinance/1.0; +https://ezfinance.pages.dev)",
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "ko,en;q=0.8",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  };

  // fetch + 리다이렉트 방지 유틸
  const fetchDart = async (fs_div) => {
    const apiUrl =
      `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json` +
      `?crtfc_key=${env.DART_API_KEY}` +
      `&corp_code=${corpCode}` +
      `&bsns_year=${year}` +
      `&reprt_code=11011` +
      `&fs_div=${fs_div}`;

    let res = await fetch(apiUrl, { headers: commonHeaders, redirect: "manual" });

    // manual redirect 처리
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("Location") || "";
      if (loc) {
        res = await fetch(loc, { headers: commonHeaders, redirect: "follow" });
      }
    }

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { data, apiUrl, statusCode: res.status };
  };

  try {
    // CFS → (필요 시) OFS 순차 시도
    let last;
    for (const fs of fsCandidates) {
      last = await fetchDart(fs);
      const { data } = last;
      // DART 정상
      if (data?.status === "000" && Array.isArray(data.list)) {
        return new Response(JSON.stringify({ ...data, fs_div: fs }), {
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      }
      // 필수값 누락(100)처럼 형식 문제면 다음 후보로 넘어감
      // 또는 특정 에러 코드(예: 013: 해당항목 없음 등)일 때도 다음 후보 시도
      if (data?.status === "100" || data?.status === "013") {
        continue;
      }
      // 그 외 에러면 즉시 반환
      break;
    }

    // 여기 오면 실패
    return new Response(
      JSON.stringify({
        error: "OpenDART error response",
        detail: last?.data || null,
      }),
      { status: 502, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "fetch failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
