import os
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder
from sklearn.impute import SimpleImputer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import GaussianNB
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

def train_and_save_pipeline(csv_path="loan_approval_data.csv", output_path="model_pipeline.joblib"):
    print("Loading dataset from:", csv_path)
    df = pd.read_csv(csv_path)

    # Clean target
    df = df.dropna(subset=["Loan_Approved"])
    target_le = LabelEncoder()
    df["Loan_Approved_Num"] = target_le.fit_transform(df["Loan_Approved"]) # No -> 0, Yes -> 1

    # Raw Feature lists
    num_cols = [
        "Applicant_Income", "Coapplicant_Income", "Age", "Dependents",
        "Credit_Score", "Existing_Loans", "DTI_Ratio", "Savings",
        "Collateral_Value", "Loan_Amount", "Loan_Term"
    ]
    
    cat_cols = [
        "Employment_Status", "Marital_Status", "Loan_Purpose",
        "Property_Area", "Education_Level", "Gender", "Employer_Category"
    ]

    # Pre-impute dataframe to engineer features safely
    num_imputer = SimpleImputer(strategy="mean")
    cat_imputer = SimpleImputer(strategy="most_frequent")

    df_imputed = df.copy()
    df_imputed[num_cols] = num_imputer.fit_transform(df[num_cols])
    df_imputed[cat_cols] = cat_imputer.fit_transform(df[cat_cols])

    # Feature Engineering
    df_imputed["DTI_Ratio_sq"] = df_imputed["DTI_Ratio"] ** 2
    df_imputed["Credit_Score_sq"] = df_imputed["Credit_Score"] ** 2
    df_imputed["Total_Income"] = df_imputed["Applicant_Income"] + df_imputed["Coapplicant_Income"]
    df_imputed["Loan_To_Income"] = df_imputed["Loan_Amount"] / (df_imputed["Total_Income"] * 12 + 1e-5)
    df_imputed["Collateral_To_Loan"] = df_imputed["Collateral_Value"] / (df_imputed["Loan_Amount"] + 1e-5)

    engineered_num_cols = num_cols + ["DTI_Ratio_sq", "Credit_Score_sq", "Total_Income", "Loan_To_Income", "Collateral_To_Loan"]

    X = df_imputed[engineered_num_cols + cat_cols]
    y = df_imputed["Loan_Approved_Num"]

    # Train/Test Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # Pipeline Transformers
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), engineered_num_cols),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_cols)
        ]
    )

    # Models to evaluate
    models = {
        "RandomForest": RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42),
        "LogisticRegression": LogisticRegression(max_iter=1000, random_state=42),
        "NaiveBayes": GaussianNB()
    }

    best_score = -1
    best_model_name = None
    best_pipeline = None
    results = {}

    for name, clf in models.items():
        pipeline = Pipeline(steps=[
            ("preprocessor", preprocessor),
            ("classifier", clf)
        ])

        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)
        y_prob = pipeline.predict_proba(X_test)[:, 1] if hasattr(pipeline, "predict_proba") else y_pred

        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred, zero_division=0)
        rec = recall_score(y_test, y_pred, zero_division=0)
        f1 = f1_score(y_test, y_pred, zero_division=0)
        roc = roc_auc_score(y_test, y_prob)

        results[name] = {"Accuracy": acc, "Precision": prec, "Recall": rec, "F1": f1, "ROC_AUC": roc}
        print(f"Model {name} -> Acc: {acc:.4f}, Prec: {prec:.4f}, Rec: {rec:.4f}, F1: {f1:.4f}, AUC: {roc:.4f}")

        # Choose best model on F1 & Accuracy
        score = f1 + acc
        if score > best_score:
            best_score = score
            best_model_name = name
            best_pipeline = pipeline

    print(f"\nBest Model Selected: {best_model_name}")

    # Extract feature names & importances
    ohe_cat_features = list(best_pipeline.named_steps["preprocessor"].named_transformers_["cat"].get_feature_names_out(cat_cols))
    all_feature_names = engineered_num_cols + ohe_cat_features

    feature_importances = {}
    if hasattr(best_pipeline.named_steps["classifier"], "feature_importances_"):
        imps = best_pipeline.named_steps["classifier"].feature_importances_
        feature_importances = dict(zip(all_feature_names, imps.tolist()))
    elif hasattr(best_pipeline.named_steps["classifier"], "coef_"):
        coefs = best_pipeline.named_steps["classifier"].coef_[0]
        feature_importances = dict(zip(all_feature_names, np.abs(coefs).tolist()))

    # Calculate Dataset Summary Stats for Backend API
    stats = {
        "total_applicants": int(len(df)),
        "approval_rate": float(round((df["Loan_Approved"] == "Yes").mean() * 100, 2)),
        "avg_applicant_income": float(round(df["Applicant_Income"].mean(), 2)),
        "avg_loan_amount": float(round(df["Loan_Amount"].mean(), 2)),
        "avg_credit_score": float(round(df["Credit_Score"].mean(), 2)),
        "avg_dti_ratio": float(round(df["DTI_Ratio"].mean(), 3)),
        "purpose_distribution": df["Loan_Purpose"].value_counts().to_dict(),
        "property_distribution": df["Property_Area"].value_counts().to_dict(),
        "employment_distribution": df["Employment_Status"].value_counts().to_dict(),
        "education_distribution": df["Education_Level"].value_counts().to_dict()
    }

    # Save Pipeline Object
    payload = {
        "pipeline": best_pipeline,
        "model_name": best_model_name,
        "results": results,
        "num_cols": num_cols,
        "cat_cols": cat_cols,
        "engineered_num_cols": engineered_num_cols,
        "target_mapping": {0: "No", 1: "Yes"},
        "feature_importances": feature_importances,
        "dataset_stats": stats,
        "num_imputer": num_imputer,
        "cat_imputer": cat_imputer
    }

    joblib.dump(payload, output_path)
    print(f"Successfully saved pipeline artifact to: {output_path}")

if __name__ == "__main__":
    train_and_save_pipeline()
