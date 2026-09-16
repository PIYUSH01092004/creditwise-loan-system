# CreditWise Loan System 🏦 AI-Powered Automated Credit Risk Assessment Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)](https://www.chartjs.org/)

**CreditWise Loan System** is an end-to-end Machine Learning web application designed for automated credit decisioning, risk evaluation, and loan eligibility assessment. Built with **FastAPI** on the backend and an **Executive Banking UI** powered by **Chart.js** on the frontend, the platform processes applicant financial metrics in real time using a trained **Random Forest Classification Engine (95.8% Accuracy)**.

---

## 🌟 Key Features

- **⚡ Real-Time ML Risk Assessment**: Evaluates loan applications against key metrics (Credit Score, DTI Ratio, Household Income, Collateral Coverage) and yields instant Approval/Rejection decisions with risk level classification.
- **📊 Executive Analytics Dashboard**: Interactive Chart.js visual analytics displaying portfolio breakdown by loan purpose, credit score distributions, AI feature importance weights, and Debt-to-Income (DTI) leverage segments.
- **📁 Applicant Database Records**: Paginated dataset browser with multi-field search and filters for inspecting historical credit records.
- **🧮 EMI & Financial Simulator**: Interactive loan calculator computing monthly EMI payments, total interest payable, and overall repayment schedules.
- **🛡️ Secure & Scalable API**: Asynchronous FastAPI backend equipped with non-caching HTTP middleware, lazy model artifact loading, and cross-version Pydantic compatibility.

---

## 🛠️ Technology Stack

- **Backend Framework**: Python 3.9+, FastAPI, Uvicorn, Pydantic, Starlette
- **Machine Learning**: Scikit-Learn (RandomForest, Logistic Regression, Gaussian Naive Bayes), Pandas, NumPy, Joblib
- **Frontend & Styling**: Vanilla HTML5, Custom CSS3 (Emerald & Gold Fintech Palette), JavaScript (ES6+), Chart.js
- **Typography & Icons**: Google Fonts (Outfit, JetBrains Mono), FontAwesome 6

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have Python 3.9 or higher installed on your system.

### 2. Clone the Repository
```bash
git clone https://github.com/PIYUSH01092004/creditwise-loan-system.git
cd creditwise-loan-system
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Train the ML Model (Optional)
The pre-trained model artifact `model_pipeline.joblib` is already included. To retrain the pipeline from `loan_approval_data.csv`:
```bash
python train_model.py
```

### 5. Launch the Web Application
```bash
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
Open your browser and navigate to: **`http://127.0.0.1:8000`**

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Serves the web interface (`static/index.html`) |
| `POST` | `/api/predict` | Accepts applicant metrics & returns ML approval decision, risk score, and EMI calculations |
| `GET` | `/api/stats` | Returns aggregate portfolio summary metrics, feature importances, and distribution bins |
| `GET` | `/api/applicants` | Fetches paginated applicant dataset records with optional status and purpose filters |

---

## 📂 Project Structure

```text
Creditwise_Loan_System/
├── main.py                  # FastAPI server & REST API endpoints
├── train_model.py           # Machine Learning training & pipeline export script
├── model_pipeline.joblib    # Serialized ML model pipeline artifact
├── loan_approval_data.csv   # Historical credit dataset
├── Credit_wise.ipynb        # Jupyter Notebook with Exploratory Data Analysis (EDA)
├── requirements.txt         # Project dependencies
├── .gitignore               # Git ignore configuration
└── static/
    ├── index.html           # Single Page Application HTML structure
    ├── css/
    │   └── styles.css       # Custom Executive Banking Theme stylesheet
    └── js/
        └── app.js           # Client-side UI logic & Chart.js rendering
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
