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

  const apiUrl =
    `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json` +
    `?crtfc_key=${env.DART_API_KEY}` +
    `&corp_code=${corpCode}` +
    `&bsns_year=${year}` +
    `&reprt_code=11011`;

  // DART가 헤더/리퍼러/UA 없다고 차단하는 경우가 있어, 헤더를 명시하고
  // 리다이렉트를 수동으로 한 번만 따라갑니다(무한루프 방지).
  const commonHeaders = {
    "User-Agent":
      "Mozilla/5.0 (compatible; EZFinance/1.0; +https://ezfinance.pages.dev)",
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "ko,en;q=0.8",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  };

  try {
    // 1차 요청: 리다이렉트 수동 처리
    let res = await fetch(apiUrl, {
      method: "GET",
      headers: commonHeaders,
      redirect: "manual",
    });

    // 리다이렉트 감지
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("Location") || "";
      // DART가 error1.html로 보내면, 바로 에러 반환
      if (/error1\.html/i.test(loc)) {
        return new Response(
          JSON.stringify({
            error:
              "OpenDART redirected to error1.html (service blocked or malformed request).",
            location: loc,
          }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }
      // 정상 리다이렉트면 한 번만 따라감
      if (loc) {
        res = await fetch(loc, {
          method: "GET",
          headers: commonHeaders,
          redirect: "follow",
        });
      }
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // DART가 간헐적으로 text/html 에러 페이지를 줄 수도 있음
      data = { raw: text };
    }

    // 응답이 또 에러 페이지라면 에러로 처리
    if (
      typeof data === "string" && /error1\.html/i.test(data)
      || (data?.status && data.status !== "000" && !data.list)
    ) {
      return new Response(
        JSON.stringify({
          error: "OpenDART error response",
          data,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "fetch failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
