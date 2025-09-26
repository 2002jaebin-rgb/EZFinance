// api.js
// OPENDART API와 통신하는 모듈
// (주의) 실제 API Key는 프론트엔드에 노출되므로 보안 위험이 있습니다.
// 프로덕션 환경에서는 반드시 Cloudflare Functions 같은 프록시를 사용하세요.

// ✅ 주요 함수
// - fetchFinancials(corpCode, year): 특정 회사, 특정 연도의 요약 재무제표 가져오기
// - fetchFinancialTrend(corpCode, years): 여러 연도의 매출/순이익 추이 데이터 가져오기
// - parseFinancials(apiData): API 응답을 재무 요약 데이터로 변환

// 기본 보고서 코드: 11011 = 사업보고서(연간)
const REPRT_CODE = "11011";

// 단일회사 요약 재무제표 조회
async function fetchFinancials(corpCode, year = "2023") {
  const url = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${DART_API_KEY}&corp_code=${corpCode}&bsns_year=${year}&reprt_code=${REPRT_CODE}`;
  const res = await fetch(url);
  return res.json();
}

// 여러 연도 추이 데이터
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

// 재무제표 데이터 파싱
function parseFinancials(apiData) {
  const map = {};
  if (!apiData || !apiData.list) return map;

  apiData.list.forEach(item => {
    const name = item.account_nm;
    if (name === "매출액") map.revenue = item.thstrm_amount;
    if (name === "영업이익") map.operatingProfit = item.thstrm_amount;
    if (name === "당기순이익") map.netIncome = item.thstrm_amount;
    if (name === "자산총계") map.totalAssets = item.thstrm_amount;
    if (name === "부채총계") map.totalLiabilities = item.thstrm_amount;
    if (name === "자본총계") map.equity = item.thstrm_amount; // ✅ 수정: 자본총계 반영
  });

  // 부채비율 = 부채총계 ÷ 자본총계 × 100
  if (map.totalLiabilities && map.equity) {
    map.debtRatio = (parseInt(map.totalLiabilities) / parseInt(map.equity) * 100).toFixed(1);
  }

  return map;
}

// export (전역 객체)
window.DartAPI = { fetchFinancials, fetchFinancialTrend, parseFinancials };
