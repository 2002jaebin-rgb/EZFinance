// api.js
// OPENDART API와 통신하는 모듈

// 주요 재무제표 (단일회사)
async function fetchFinancials(corpCode, year = "2023") {
    const url = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${DART_API_KEY}&corp_code=${corpCode}&bsns_year=${year}&reprt_code=11011`;
    const res = await fetch(url);
    return res.json();
  }
  
  // 최근 3개년 재무제표 (매출액 & 순이익만 추출)
  async function fetchFinancialTrend(corpCode, years = ["2021", "2022", "2023"]) {
    const trend = { years: [], revenue: [], netIncome: [] };
  
    for (let year of years) {
      const data = await fetchFinancials(corpCode, year);
      if (data && data.list) {
        const rev = data.list.find(i => i.account_nm === "매출액");
        const net = data.list.find(i => i.account_nm === "당기순이익");
        trend.years.push(year);
        trend.revenue.push(rev ? Number(rev.thstrm_amount) / 1e12 : 0); // 조 단위 변환
        trend.netIncome.push(net ? Number(net.thstrm_amount) / 1e12 : 0);
      }
    }
    return trend;
  }
  
  // 데이터 가공 (한 해 기준)
  function parseFinancials(apiData) {
    const map = {};
    apiData.list.forEach(item => {
      if (item.account_nm === "매출액") map.revenue = item.thstrm_amount;
      if (item.account_nm === "영업이익") map.operatingProfit = item.thstrm_amount;
      if (item.account_nm === "당기순이익") map.netIncome = item.thstrm_amount;
      if (item.account_nm === "자산총계") map.totalAssets = item.thstrm_amount;
      if (item.account_nm === "부채총계") map.totalLiabilities = item.thstrm_amount;
      if (item.account_nm === "자본금") map.capital = item.thstrm_amount;
    });
    if (map.totalLiabilities && map.capital) {
      map.debtRatio = (parseInt(map.totalLiabilities) / parseInt(map.capital) * 100).toFixed(1);
    }
    return map;
  }
  
  // 모듈 export
  window.DartAPI = { fetchFinancials, fetchFinancialTrend, parseFinancials };
  