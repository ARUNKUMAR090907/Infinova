import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_cases_list():
    res = client.get("/api/cases")
    assert res.status_code == 200
    data = res.json()
    assert "data" in data
    cases = data["data"]["cases"]
    assert len(cases) >= 1
    case_ids = [c["case_id"] for c in cases]
    assert "CASE-2025-MSC-ELSA-3" in case_ids
    print("PASS: list_cases")

def test_case_detail():
    res = client.get("/api/cases/CASE-2025-MSC-ELSA-3")
    assert res.status_code == 200
    c = res.json()["data"]
    assert c["name"] == "MSC ELSA 3 Heavy Fuel Oil Discharge"
    assert "inputs" in c
    assert "ground_truth" in c
    print("PASS: case_detail")

def test_validate_inputs():
    res = client.post("/api/cases/CASE-2025-MSC-ELSA-3/validate-inputs")
    assert res.status_code == 200
    val = res.json()["data"]
    assert val["is_valid"] is True
    assert val["can_proceed"] is True
    print("PASS: validate_inputs")

def test_run_analysis():
    res = client.post("/api/cases/CASE-2025-MSC-ELSA-3/analyze")
    assert res.status_code == 200
    analysis = res.json()["data"]
    assert "detection" in analysis
    assert "hindcast" in analysis
    assert "attribution" in analysis
    assert "forecast" in analysis
    assert len(analysis["attribution"]["ranked"]) > 0
    # MSC ELSA 3 should be ranked #1
    top = analysis["attribution"]["ranked"][0]
    assert top["mmsi"] == "356892000"
    print(f"PASS: run_analysis (Top suspect: {top['name']}, Score: {top['score']})")

def test_run_validation():
    res = client.post("/api/cases/CASE-2025-MSC-ELSA-3/validate")
    assert res.status_code == 200
    val = res.json()["data"]
    assert "horizons" in val
    assert len(val["horizons"]) >= 3
    assert val["mean_trajectory_error_km"] >= 0.0
    assert val["vessel_ranking_validation"]["is_top_1"] is True
    print(f"PASS: run_validation (MTE: {val['mean_trajectory_error_km']} km, Top-1 match: {val['vessel_ranking_validation']['is_top_1']})")

def test_case_report_pdf():
    res_gen = client.post("/api/cases/CASE-2025-MSC-ELSA-3/report/generate")
    assert res_gen.status_code == 200
    data = res_gen.json()["data"]
    assert data["ok"] is True
    assert data["filename"].endswith(".pdf")

    res_pdf = client.get("/api/cases/CASE-2025-MSC-ELSA-3/report/pdf")
    assert res_pdf.status_code == 200
    assert res_pdf.headers["content-type"] == "application/pdf"
    assert len(res_pdf.content) > 1000
    assert res_pdf.content[:4] == b"%PDF"
    print("PASS: case_report_pdf (valid PDF generated and downloaded)")

if __name__ == "__main__":
    test_cases_list()
    test_case_detail()
    test_validate_inputs()
    test_run_analysis()
    test_run_validation()
    test_case_report_pdf()
    print("ALL TESTS PASSED SUCCESSFULLY!")

