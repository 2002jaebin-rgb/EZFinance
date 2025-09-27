import os
import requests
import FinanceDataReader as fdr
from datetime import datetime

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("환경변수 SUPABASE_URL, SUPABASE_KEY가 필요합니다.")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def upsert(table, rows):
    """Supabase 테이블에 데이터 업서트"""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    resp = requests.post(url, headers=HEADERS, json=rows, params={"on_conflict": "stock_code"})
    if resp.status_code not in (200, 201):
        print(f"❌ 업서트 실패 [{table}] {resp.status_code}: {resp.text}")
    else:
        print(f"✅ 업서트 성공 [{table}] {len(rows)} rows")

def sync_companies():
    """상장기업 리스트 동기화 (KOSPI + KOSDAQ)"""
    kospi = fdr.StockListing("KOSPI")
    kosdaq = fdr.StockListing("KOSDAQ")
    companies = kospi.append(kosdaq)

    rows = []
    for _, row in companies.iterrows():
        rows.append({
            "stock_code": str(row["Code"]).zfill(6),
            "name": row["Name"],
            "market": row.get("Market", None),
            "industry": row.get("Sector", None),
            "listing_date": row.get("ListingDate", None)
        })

    if rows:
        upsert("companies", rows)

def sync_financials(limit=20):
    """재무 데이터 동기화 (테스트용: 상위 N개 기업만)"""
    import pandas as pd

    kospi = fdr.StockListing("KOSPI")
    tickers = kospi["Code"].head(limit)  # 상위 N개만 테스트
    rows = []

    for code in tickers:
        try:
            df = fdr.Financials(code)
            if df.empty:
                print(f"⚠️ No data for {code}")
                continue

            # df 구조: (항목, 연도/분기) 형태 → 전처리
            for period, values in df.items():
                year, quarter = parse_period(period)
                rows.append({
                    "stock_code": str(code).zfill(6),
                    "year": year,
                    "quarter": quarter,
                    "revenue": safe_get(values, "매출액"),
                    "op_income": safe_get(values, "영업이익"),
                    "net_income": safe_get(values, "당기순이익"),
                    "assets": safe_get(values, "자산총계"),
                    "liabilities": safe_get(values, "부채총계"),
                    "capital": safe_get(values, "자본금")
                })

        except Exception as e:
            print(f"❌ Error {code}: {e}")

    if rows:
        upsert("financials", rows)

def parse_period(period):
    """
    FDR Financials 컬럼명 예시: '2023/12' (연간), '2023/09' (3Q)
    - 03 → 1분기
    - 06 → 2분기
    - 09 → 3분기
    - 12 → 연간(quarter=0)
    """
    year, month = period.split("/")
    year = int(year)
    month = int(month)
    q_map = {3:1, 6:2, 9:3, 12:0}
    return year, q_map.get(month, 0)

def safe_get(series, key):
    """재무 항목 안전하게 가져오기"""
    return series[key] if key in series else None

if __name__ == "__main__":
    print("🚀 Sync start:", datetime.now())
    sync_companies()
    sync_financials(limit=20)  # 테스트: 20개 기업만
    print("✅ Sync completed:", datetime.now())
