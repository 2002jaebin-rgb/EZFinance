// functions/api/company.js
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const corpCode = url.searchParams.get("corp"); // corp_code 필요
  
    if (!corpCode) {
      return new Response(JSON.stringify({ error: "corp parameter required" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
  
    const apiUrl =
      `https://opendart.fss.or.kr/api/company.json` +
      `?crtfc_key=${env.DART_API_KEY}` +
      `&corp_code=${corpCode}`;
  
    const headers = {
      "User-Agent": "Mozilla/5.0 (compatible; EZFinance/1.0; +https://ezfinance.pages.dev)",
      "Accept": "application/json,text/plain,*/*",
      "Accept-Language": "ko,en;q=0.8",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    };
  
    try {
      let res = await fetch(apiUrl, { headers, redirect: "manual" });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("Location");
        if (loc) res = await fetch(loc, { headers, redirect: "follow" });
      }
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  
      if (data?.status && data.status !== "000") {
        return new Response(JSON.stringify({ error: "OpenDART error", detail: data }), {
          status: 502,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
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
  