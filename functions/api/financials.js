export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const corp = url.searchParams.get("corp");
  const year = url.searchParams.get("year") || new Date().getFullYear() - 1;

  if (!corp) {
    return new Response(JSON.stringify({ error: "corp is required" }), { status: 400 });
  }

  const apiUrl = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${env.DART_API_KEY}&corp_code=${corp}&bsns_year=${year}&reprt_code=11011&fs_div=CFS`;

  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

    if (data.status !== "000") {
      return new Response(JSON.stringify({ error: "OpenDART error", data }), { status: 502 });
    }

    // 계정명 매핑 테이블
    const accountMap = {
      "매출액": "매출액",
      "영업수익": "매출액",
      "매출수익": "매출액",

      "영업이익": "영업이익",
      "영업손실": "영업이익",

      "당기순이익": "당기순이익",
      "당기순손실": "당기순이익",

      "자산총계": "자산총계",
      "총자산": "자산총계",

      "부채총계": "부채총계",
      "총부채": "부채총계",

      "자본금": "자본금",
      "납입자본금": "자본금"
    };

    // summary 추출
    const summary = {};
    for (const item of data.list || []) {
      const key = accountMap[item.account_nm];
      if (key) {
        summary[key] = {
          당기: item.thstrm_amount,
          전기: item.frmtrm_amount,
          전전기: item.bfefrmtrm_amount
        };
      }
    }

    return new Response(JSON.stringify({ corp, year, summary }, null, 2), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Exception", details: err.message }), {
      status: 500
    });
  }
}
