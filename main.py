from contextlib import asynccontextmanager
import os
import math
import joblib
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from starlette.middleware.base import BaseHTTPMiddleware

# Global variables for loaded model pipeline & dataset
MODEL_PATH = "model_pipeline.joblib"
DATASET_PATH = "loan_approval_data.csv"

pipeline_data = None
dataset_df = None

def load_artifacts():
    global pipeline_data, dataset_df
    if pipeline_data is None and os.path.exists(MODEL_PATH):
        try:
            pipeline_data = joblib.load(MODEL_PATH)
            print(f"Loaded ML model pipeline: {pipeline_data.get('model_name', 'Unknown')}")
        except Exception as err:
            print(f"Error loading model pipeline: {err}")

    if dataset_df is None and os.path.exists(DATASET_PATH):
        try:
            dataset_df = pd.read_csv(DATASET_PATH)
            print(f"Loaded dataset: {len(dataset_df)} rows.")
        except Exception as err:
            print(f"Error loading dataset: {err}")

def ensure_artifacts_loaded():
    if pipeline_data is None or dataset_df is None:
        load_artifacts()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    load_artifacts()
    yield
    # Shutdown logic (if any)

# Initialize FastAPI App
app = FastAPI(
    title="CreditWise Loan System API",
    description="Machine Learning Loan Approval & Risk Assessment Backend for SecureTrust Bank",
    version="1.0.0",
    lifespan=lifespan
)

class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

app.add_middleware(NoCacheMiddleware)

# Helper for JSON serialization safety with numpy types
def clean_numpy_types(obj):
    if isinstance(obj, dict):
        return {k: clean_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_numpy_types(item) for item in obj]
    elif isinstance(obj, (np.int64, np.int32, np.int16, np.int8)):
        return int(obj)
    elif isinstance(obj, (np.float64, np.float32, np.float16)):
        return float(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif pd.isna(obj):
        return None
    return obj

# Input Pydantic Model
class LoanApplicationInput(BaseModel):
    Applicant_Income: float = Field(..., example=8500.0, description="Monthly income in INR (₹)")
    Coapplicant_Income: float = Field(default=0.0, example=2500.0, description="Co-applicant monthly income")
    Age: float = Field(..., example=35.0, description="Applicant age")
    Dependents: float = Field(default=0.0, example=1.0, description="Number of dependents")
    Credit_Score: float = Field(..., example=720.0, description="Credit Score (300 - 850)")
    Existing_Loans: float = Field(default=0.0, example=1.0, description="Number of active loans")
    DTI_Ratio: float = Field(..., example=0.28, description="Debt-to-Income Ratio (0.0 to 1.0)")
    Savings: float = Field(..., example=15000.0, description="Savings balance")
    Collateral_Value: float = Field(..., example=35000.0, description="Collateral asset value")
    Loan_Amount: float = Field(..., example=20000.0, description="Requested loan amount")
    Loan_Term: float = Field(..., example=36.0, description="Loan duration in months")
    Employment_Status: str = Field(..., example="Salaried", description="Salaried / Self-employed / Contract / Unemployed")
    Marital_Status: str = Field(..., example="Married", description="Married / Single")
    Loan_Purpose: str = Field(..., example="Home", description="Home / Personal / Car / Business / Education")
    Property_Area: str = Field(..., example="Urban", description="Urban / Semiurban / Rural")
    Education_Level: str = Field(..., example="Graduate", description="Graduate / Not Graduate")
    Gender: str = Field(..., example="Male", description="Male / Female")
    Employer_Category: str = Field(..., example="Private", description="Private / Government / MNC / Business / Unemployed")

# Serve Static files & Index UI
static_dir = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def get_homepage():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return JSONResponse({"message": "CreditWise API is running. static/index.html not found yet."})

@app.post("/api/predict")
def predict_loan(input_data: LoanApplicationInput):
    ensure_artifacts_loaded()
    if not pipeline_data:
        raise HTTPException(status_code=500, detail="Model pipeline artifact is missing or could not be loaded. Run train_model.py first.")

    pipeline = pipeline_data["pipeline"]

    # Convert input to DataFrame (support Pydantic v1 & v2)
    data_dict = input_data.model_dump() if hasattr(input_data, "model_dump") else input_data.dict()
    
    # Feature Engineering
    dti_sq = data_dict["DTI_Ratio"] ** 2
    credit_sq = data_dict["Credit_Score"] ** 2
    total_income = data_dict["Applicant_Income"] + data_dict["Coapplicant_Income"]
    loan_to_income = data_dict["Loan_Amount"] / (total_income * 12 + 1e-5)
    collateral_to_loan = data_dict["Collateral_Value"] / (data_dict["Loan_Amount"] + 1e-5)

    df_row = pd.DataFrame([{
        "Applicant_Income": data_dict["Applicant_Income"],
        "Coapplicant_Income": data_dict["Coapplicant_Income"],
        "Age": data_dict["Age"],
        "Dependents": data_dict["Dependents"],
        "Credit_Score": data_dict["Credit_Score"],
        "Existing_Loans": data_dict["Existing_Loans"],
        "DTI_Ratio": data_dict["DTI_Ratio"],
        "Savings": data_dict["Savings"],
        "Collateral_Value": data_dict["Collateral_Value"],
        "Loan_Amount": data_dict["Loan_Amount"],
        "Loan_Term": data_dict["Loan_Term"],
        "DTI_Ratio_sq": dti_sq,
        "Credit_Score_sq": credit_sq,
        "Total_Income": total_income,
        "Loan_To_Income": loan_to_income,
        "Collateral_To_Loan": collateral_to_loan,
        "Employment_Status": data_dict["Employment_Status"],
        "Marital_Status": data_dict["Marital_Status"],
        "Loan_Purpose": data_dict["Loan_Purpose"],
        "Property_Area": data_dict["Property_Area"],
        "Education_Level": data_dict["Education_Level"],
        "Gender": data_dict["Gender"],
        "Employer_Category": data_dict["Employer_Category"]
    }])

    # Run Prediction
    pred_class = int(pipeline.predict(df_row)[0]) # 1 = Yes (Approved), 0 = No (Rejected)
    probabilities = pipeline.predict_proba(df_row)[0]
    approval_prob = float(probabilities[1]) # Probability of approval

    decision = "Approved" if pred_class == 1 else "Rejected"

    # Risk Assessment
    if approval_prob >= 0.75 and data_dict["Credit_Score"] >= 650 and data_dict["DTI_Ratio"] <= 0.40:
        risk_level = "Low Risk"
        risk_color = "#10B981" # Emerald
    elif approval_prob >= 0.45 and data_dict["Credit_Score"] >= 580:
        risk_level = "Moderate Risk"
        risk_color = "#F59E0B" # Amber
    else:
        risk_level = "High Risk"
        risk_color = "#EF4444" # Crimson

    # Financial EMI Calculation
    annual_rate = 0.105 # 10.5% interest rate standard
    monthly_rate = annual_rate / 12.0
    n_months = max(1.0, data_dict["Loan_Term"])
    P = data_dict["Loan_Amount"]
    
    if monthly_rate > 0:
        emi = P * monthly_rate * ((1 + monthly_rate)**n_months) / (((1 + monthly_rate)**n_months) - 1)
    else:
        emi = P / n_months

    total_payment = emi * n_months
    total_interest = total_payment - P

    # Maximum Recommended Loan Amount
    monthly_disposable = max(0, total_income * (1 - data_dict["DTI_Ratio"]))
    max_affordable_emi = monthly_disposable * 0.45
    max_loan_recommended = max_affordable_emi * (((1 + monthly_rate)**n_months) - 1) / (monthly_rate * ((1 + monthly_rate)**n_months) + 1e-5)

    # Key Approval / Risk Insights
    insights = []
    if data_dict["Credit_Score"] >= 700:
        insights.append({"type": "positive", "text": f"Strong Credit Score ({int(data_dict['Credit_Score'])}) significantly boosts eligibility."})
    elif data_dict["Credit_Score"] < 600:
        insights.append({"type": "negative", "text": f"Low Credit Score ({int(data_dict['Credit_Score'])}) increases default risk."})

    if data_dict["DTI_Ratio"] <= 0.35:
        insights.append({"type": "positive", "text": f"Healthy Debt-to-Income Ratio ({round(data_dict['DTI_Ratio']*100, 1)}%)."})
    elif data_dict["DTI_Ratio"] > 0.45:
        insights.append({"type": "negative", "text": f"High Debt-to-Income Ratio ({round(data_dict['DTI_Ratio']*100, 1)}%) indicates heavy financial strain."})

    if collateral_to_loan >= 1.2:
        insights.append({"type": "positive", "text": f"Excellent collateral coverage ({round(collateral_to_loan*100, 1)}% of loan amount)."})
    elif collateral_to_loan < 0.8:
        insights.append({"type": "negative", "text": f"Low collateral coverage ({round(collateral_to_loan*100, 1)}% of loan amount)."})

    if data_dict["Employment_Status"] in ["Salaried", "Self-employed"] and data_dict["Employer_Category"] in ["Government", "MNC", "Private"]:
        insights.append({"type": "positive", "text": f"Stable employment profile as {data_dict['Employment_Status']} ({data_dict['Employer_Category']})."})

    return {
        "decision": decision,
        "approval_probability": round(approval_prob * 100, 1),
        "rejection_probability": round((1 - approval_prob) * 100, 1),
        "risk_level": risk_level,
        "risk_color": risk_color,
        "financial_summary": {
            "requested_loan_amount": round(P, 2),
            "loan_term_months": int(n_months),
            "estimated_emi": round(emi, 2),
            "total_payment": round(total_payment, 2),
            "total_interest": round(total_interest, 2),
            "max_loan_recommended": round(max_loan_recommended, 2),
            "collateral_coverage_pct": round(collateral_to_loan * 100, 1),
            "loan_to_annual_income_ratio": round(loan_to_income, 2)
        },
        "key_insights": insights,
        "model_used": pipeline_data["model_name"]
    }

@app.get("/api/stats")
def get_analytics_stats():
    ensure_artifacts_loaded()
    if not pipeline_data:
        raise HTTPException(status_code=500, detail="Pipeline data not loaded.")

    stats = clean_numpy_types(pipeline_data["dataset_stats"].copy())
    model_metrics = clean_numpy_types(pipeline_data["results"])
    best_model_name = pipeline_data["model_name"]
    best_metrics = model_metrics.get(best_model_name, {})

    # Top feature importances
    raw_imps = pipeline_data.get("feature_importances", {})
    sorted_imps = sorted(raw_imps.items(), key=lambda x: x[1], reverse=True)[:10]
    top_features = [{"feature": k, "importance": round(float(v), 4)} for k, v in sorted_imps]

    # Additional dataset metrics if df loaded
    credit_bins = {"< 600 (Poor)": 0, "600 - 699 (Fair)": 0, "700 - 799 (Good)": 0, "800+ (Excellent)": 0}
    dti_bins = {"< 20% (Low)": 0, "20% - 40% (Moderate)": 0, "> 40% (High)": 0}

    if dataset_df is not None:
        c_scores = dataset_df["Credit_Score"].dropna()
        credit_bins["< 600 (Poor)"] = int((c_scores < 600).sum())
        credit_bins["600 - 699 (Fair)"] = int(((c_scores >= 600) & (c_scores < 700)).sum())
        credit_bins["700 - 799 (Good)"] = int(((c_scores >= 700) & (c_scores < 800)).sum())
        credit_bins["800+ (Excellent)"] = int((c_scores >= 800).sum())

        dtis = dataset_df["DTI_Ratio"].dropna()
        dti_bins["< 20% (Low)"] = int((dtis < 0.20).sum())
        dti_bins["20% - 40% (Moderate)"] = int(((dtis >= 0.20) & (dtis <= 0.40)).sum())
        dti_bins["> 40% (High)"] = int((dtis > 0.40).sum())

    return {
        "dataset_summary": stats,
        "model_performance": {
            "best_model_name": best_model_name,
            "accuracy": round(float(best_metrics.get("Accuracy", 0)) * 100, 2),
            "precision": round(float(best_metrics.get("Precision", 0)) * 100, 2),
            "recall": round(float(best_metrics.get("Recall", 0)) * 100, 2),
            "f1_score": round(float(best_metrics.get("F1", 0)) * 100, 2),
            "roc_auc": round(float(best_metrics.get("ROC_AUC", 0)), 4),
            "all_models": model_metrics
        },
        "top_features": top_features,
        "credit_bins": credit_bins,
        "dti_bins": dti_bins
    }

@app.get("/api/applicants")
def get_applicants(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    search: str = Query("", description="Search by ID or Employment"),
    status: str = Query("all", description="Approved / Rejected / all"),
    purpose: str = Query("all", description="Filter by Loan Purpose")
):
    ensure_artifacts_loaded()
    if dataset_df is None:
        raise HTTPException(status_code=500, detail="Dataset not loaded.")

    df = dataset_df.copy()

    # Apply filters
    if status != "all":
        df = df[df["Loan_Approved"].astype(str).str.lower() == status.lower()]
    
    if purpose != "all":
        df = df[df["Loan_Purpose"].astype(str).str.lower() == purpose.lower()]

    if search.strip():
        s = search.strip().lower()
        df = df[
            df["Applicant_ID"].astype(str).str.lower().str.contains(s) |
            df["Employment_Status"].astype(str).str.lower().str.contains(s) |
            df["Employer_Category"].astype(str).str.lower().str.contains(s) |
            df["Property_Area"].astype(str).str.lower().str.contains(s)
        ]

    total_records = len(df)
    total_pages = math.ceil(total_records / limit) if total_records > 0 else 1

    start_idx = (page - 1) * limit
    end_idx = start_idx + limit

    records = df.iloc[start_idx:end_idx].to_dict(orient="records")

    # Clean records, cast Applicant_ID to int, and convert numpy types for JSON safety
    cleaned_records = []
    for r in records:
        cleaned = {}
        for k, v in r.items():
            if pd.isna(v):
                cleaned[k] = None
            elif k == "Applicant_ID" and v is not None:
                try:
                    cleaned[k] = int(v)
                except (ValueError, TypeError):
                    cleaned[k] = str(v)
            else:
                cleaned[k] = clean_numpy_types(v)
        cleaned_records.append(cleaned)

    return {
        "page": page,
        "limit": limit,
        "total_records": total_records,
        "total_pages": total_pages,
        "applicants": cleaned_records
    }

