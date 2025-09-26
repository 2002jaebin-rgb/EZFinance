// functions/financials.js
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
  
    const corpCode = url.searchParams.get("corp");
    const year = url.searchParams.get("year") || "2023";
  
    if (!corpCode) {
      return new Response(JSON.stringify({ error: "corp parameter required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  
    const apiUrl = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${env.DART_API_KEY}&corp_code=${corpCode}&bsns_year=${year}&reprt_code=11011`;
  
    const res = await fetch(apiUrl);
    const data = await res.json();
  
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });
  }
  