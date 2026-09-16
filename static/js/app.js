// CreditWise Loan System - Frontend Logic (Indian Rupee ₹ Theme)
document.addEventListener('DOMContentLoaded', () => {

  // Global Chart instances
  let chartPurpose = null;
  let chartCredit = null;
  let chartFeatures = null;
  let chartDTI = null;

  // Applicant database pagination state
  let currentApplicantPage = 1;
  const applicantLimit = 10;

  // Initializations
  initTabs();
  initFormInputs();
  initSampleDataButton();
  initApplicantsTable();
  initSimulator();
  fetchDashboardStats();

  // ==================== TAB NAVIGATION ====================
  function initTabs() {
    const tabButtons = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');

        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(targetTab).classList.add('active');

        // Lazy load charts if opening dashboard
        if (targetTab === 'tab-dashboard') {
          fetchDashboardStats();
        } else if (targetTab === 'tab-applicants') {
          fetchApplicantRecords();
        }
      });
    });
  }

  // ==================== FORM INPUT LISTENERS & LIVE PREVIEW ====================
  function initFormInputs() {
    const sliders = [
      { id: 'Applicant_Income', badge: 'val-income', prefix: '₹', suffix: '' },
      { id: 'Coapplicant_Income', badge: 'val-coincome', prefix: '₹', suffix: '' },
      { id: 'Credit_Score', badge: 'val-credit', prefix: '', suffix: '' },
      { id: 'DTI_Ratio', badge: 'val-dti', prefix: '', suffix: '%', isPct: true },
      { id: 'Loan_Amount', badge: 'val-loanamt', prefix: '₹', suffix: '' },
      { id: 'Loan_Term', badge: 'val-term', prefix: '', suffix: ' mos' }
    ];

    sliders.forEach(s => {
      const elem = document.getElementById(s.id);
      const badge = document.getElementById(s.badge);

      if (elem && badge) {
        elem.addEventListener('input', () => {
          let val = parseFloat(elem.value);
          if (s.isPct) {
            badge.textContent = `${(val * 100).toFixed(1)}%`;
          } else if (s.prefix === '₹') {
            badge.textContent = `₹${val.toLocaleString()}`;
          } else {
            badge.textContent = `${val}${s.suffix}`;
          }
          updateLivePreview();
        });
      }
    });

    // Numerical & select inputs update live preview too
    ['Savings', 'Collateral_Value'].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.addEventListener('input', updateLivePreview);
    });

    // Form submission
    const form = document.getElementById('loan-form');
    if (form) {
      form.addEventListener('submit', handleLoanFormSubmit);
    }

    updateLivePreview();
  }

  function updateLivePreview() {
    const appIncome = parseFloat(document.getElementById('Applicant_Income').value) || 0;
    const coIncome = parseFloat(document.getElementById('Coapplicant_Income').value) || 0;
    const loanAmt = parseFloat(document.getElementById('Loan_Amount').value) || 1;
    const loanTerm = parseFloat(document.getElementById('Loan_Term').value) || 12;
    const collateral = parseFloat(document.getElementById('Collateral_Value').value) || 0;
    const dti = parseFloat(document.getElementById('DTI_Ratio').value) || 0;

    const totalIncome = appIncome + coIncome;
    document.getElementById('prev-total-income').textContent = `₹${totalIncome.toLocaleString()} / mo`;

    // Monthly EMI calculation (10.5% rate)
    const monthlyRate = 0.105 / 12;
    const emi = (loanAmt * monthlyRate * Math.pow(1 + monthlyRate, loanTerm)) / (Math.pow(1 + monthlyRate, loanTerm) - 1);
    document.getElementById('prev-emi').textContent = `₹${emi.toFixed(2)} / mo`;

    // Collateral coverage ratio
    const collateralPct = (collateral / loanAmt) * 100;
    const collateralElem = document.getElementById('prev-collateral-pct');
    collateralElem.textContent = `${collateralPct.toFixed(1)}%`;
    if (collateralPct >= 100) collateralElem.className = 'kpi-val green';
    else if (collateralPct >= 60) collateralElem.className = 'kpi-val amber';
    else collateralElem.className = 'kpi-val red';

    // DTI Status
    const dtiElem = document.getElementById('prev-dti-status');
    const dtiPct = (dti * 100).toFixed(1);
    if (dti <= 0.35) {
      dtiElem.textContent = `Healthy (${dtiPct}%)`;
      dtiElem.className = 'kpi-val green';
    } else if (dti <= 0.45) {
      dtiElem.textContent = `Moderate (${dtiPct}%)`;
      dtiElem.className = 'kpi-val amber';
    } else {
      dtiElem.textContent = `High Risk (${dtiPct}%)`;
      dtiElem.className = 'kpi-val red';
    }
  }

  function initSampleDataButton() {
    const btn = document.getElementById('btn-fill-sample');
    if (!btn) return;

    btn.addEventListener('click', () => {
      document.getElementById('Applicant_Income').value = 125000;
      document.getElementById('Applicant_Income').dispatchEvent(new Event('input'));

      document.getElementById('Coapplicant_Income').value = 35000;
      document.getElementById('Coapplicant_Income').dispatchEvent(new Event('input'));

      document.getElementById('Credit_Score').value = 750;
      document.getElementById('Credit_Score').dispatchEvent(new Event('input'));

      document.getElementById('DTI_Ratio').value = 0.22;
      document.getElementById('DTI_Ratio').dispatchEvent(new Event('input'));

      document.getElementById('Savings').value = 350000;
      document.getElementById('Collateral_Value').value = 1000000;

      document.getElementById('Loan_Amount').value = 650000;
      document.getElementById('Loan_Amount').dispatchEvent(new Event('input'));

      document.getElementById('Loan_Term').value = 48;
      document.getElementById('Loan_Term').dispatchEvent(new Event('input'));

      document.getElementById('Loan_Purpose').value = 'Home';
      document.getElementById('Employment_Status').value = 'Salaried';
      document.getElementById('Employer_Category').value = 'MNC';

      updateLivePreview();
    });
  }

  // ==================== LOAN FORM SUBMISSION & PREDICTION ====================
  async function handleLoanFormSubmit(e) {
    e.preventDefault();

    const btnSubmit = document.getElementById('btn-predict');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Evaluating Credit Risk & Profile...`;
    btnSubmit.disabled = true;

    const payload = {
      Applicant_Income: parseFloat(document.getElementById('Applicant_Income').value),
      Coapplicant_Income: parseFloat(document.getElementById('Coapplicant_Income').value),
      Age: parseFloat(document.getElementById('Age').value),
      Dependents: parseFloat(document.getElementById('Dependents').value),
      Credit_Score: parseFloat(document.getElementById('Credit_Score').value),
      Existing_Loans: parseFloat(document.getElementById('Existing_Loans').value),
      DTI_Ratio: parseFloat(document.getElementById('DTI_Ratio').value),
      Savings: parseFloat(document.getElementById('Savings').value),
      Collateral_Value: parseFloat(document.getElementById('Collateral_Value').value),
      Loan_Amount: parseFloat(document.getElementById('Loan_Amount').value),
      Loan_Term: parseFloat(document.getElementById('Loan_Term').value),
      Employment_Status: document.getElementById('Employment_Status').value,
      Marital_Status: document.getElementById('Marital_Status').value,
      Loan_Purpose: document.getElementById('Loan_Purpose').value,
      Property_Area: document.getElementById('Property_Area').value,
      Education_Level: document.getElementById('Education_Level').value,
      Gender: document.getElementById('Gender').value,
      Employer_Category: document.getElementById('Employer_Category').value
    };

    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('API Prediction Error');

      const data = await response.json();
      displayPredictionResult(data);

    } catch (err) {
      alert('Error evaluating loan model prediction: ' + err.message);
    } finally {
      btnSubmit.innerHTML = originalText;
      btnSubmit.disabled = false;
    }
  }

  function displayPredictionResult(data) {
    const resultCard = document.getElementById('result-card');
    const banner = document.getElementById('decision-banner');
    const iconElem = document.getElementById('decision-icon');
    const statusElem = document.getElementById('decision-status');
    const subtextElem = document.getElementById('decision-subtext');
    const scoreElem = document.getElementById('prob-score-num');

    resultCard.classList.add('active');

    if (data.decision === 'Approved') {
      banner.className = 'decision-banner approved';
      iconElem.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
      statusElem.textContent = 'LOAN APPLICATION APPROVED';
      subtextElem.textContent = `The applicant meets SecureTrust Bank ML risk criteria (${data.model_used}).`;
      scoreElem.textContent = `${data.approval_probability}%`;
    } else {
      banner.className = 'decision-banner rejected';
      iconElem.innerHTML = `<i class="fa-solid fa-circle-xmark"></i>`;
      statusElem.textContent = 'LOAN APPLICATION REJECTED';
      subtextElem.textContent = `Application exceeds risk tolerance threshold. Review parameters below.`;
      scoreElem.textContent = `${data.rejection_probability}%`;
    }

    // Populate Risk & Financial summary
    const riskElem = document.getElementById('res-risk-level');
    riskElem.textContent = data.risk_level;
    riskElem.style.color = data.risk_color;

    document.getElementById('res-max-loan').textContent = `₹${data.financial_summary.max_loan_recommended.toLocaleString()}`;
    const reqLoan = data.financial_summary.requested_loan_amount || parseFloat(document.getElementById('Loan_Amount').value);
    document.getElementById('res-requested-loan').textContent = `₹${reqLoan.toLocaleString()}`;
    const termMonths = data.financial_summary.loan_term_months || document.getElementById('Loan_Term').value;
    document.getElementById('res-loan-term').textContent = `${termMonths} Months`;
    document.getElementById('res-emi').textContent = `₹${data.financial_summary.estimated_emi.toLocaleString()}`;
    document.getElementById('res-total-repay').textContent = `₹${data.financial_summary.total_payment.toLocaleString()}`;
    document.getElementById('res-interest').textContent = `₹${data.financial_summary.total_interest.toLocaleString()}`;
    document.getElementById('res-collateral-ratio').textContent = `${data.financial_summary.collateral_coverage_pct}%`;

    // Populate Insights List
    const insightList = document.getElementById('insight-list');
    insightList.innerHTML = '';

    if (data.key_insights && data.key_insights.length > 0) {
      data.key_insights.forEach(ins => {
        const item = document.createElement('div');
        item.className = `insight-item ${ins.type}`;
        const icon = ins.type === 'positive' ? 'fa-circle-check' : 'fa-triangle-exclamation';
        item.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${ins.text}</span>`;
        insightList.appendChild(item);
      });
    } else {
      insightList.innerHTML = `<div class="insight-item positive"><i class="fa-solid fa-check"></i> <span>Standard financial profile.</span></div>`;
    }

    // Scroll smoothly to results
    resultCard.scrollIntoView({ behavior: 'smooth' });
  }

  // ==================== DASHBOARD STATS & CHART.JS ====================
  const featureNameMap = {
    'DTI_Ratio': 'Debt-to-Income (DTI)',
    'DTI_Ratio_sq': 'DTI Non-Linear Risk',
    'Credit_Score': 'Credit Score Metric',
    'Credit_Score_sq': 'Credit Score Scale',
    'Applicant_Income': 'Applicant Income',
    'Coapplicant_Income': 'Co-applicant Income',
    'Total_Income': 'Household Income',
    'Loan_Amount': 'Loan Amount Requested',
    'Loan_To_Income': 'Loan-to-Income Ratio',
    'Collateral_Value': 'Collateral Asset Value',
    'Collateral_To_Loan': 'Collateral Coverage Ratio',
    'Savings': 'Savings Balance',
    'Loan_Term': 'Loan Duration (Tenure)',
    'Age': 'Applicant Age',
    'Dependents': 'Dependents Count',
    'Existing_Loans': 'Active Loans Count'
  };

  const commonTooltipOptions = {
    backgroundColor: '#0F172A',
    titleColor: '#F8FAFC',
    bodyColor: '#E2E8F0',
    titleFont: { family: 'Outfit', size: 13, weight: '700' },
    bodyFont: { family: 'Outfit', size: 12, weight: '500' },
    padding: 12,
    cornerRadius: 8,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    boxPadding: 6
  };

  async function fetchDashboardStats() {
    try {
      const response = await fetch('/api/stats');
      if (!response.ok) return;

      const data = await response.json();

      // Update KPI cards
      document.getElementById('dash-total-apps').textContent = data.dataset_summary.total_applicants.toLocaleString();
      document.getElementById('dash-approval-rate').textContent = `${data.dataset_summary.approval_rate}%`;
      document.getElementById('dash-model-acc').textContent = `${data.model_performance.accuracy}%`;
      document.getElementById('dash-avg-credit').textContent = data.dataset_summary.avg_credit_score;

      // Update Top Status Pill
      document.getElementById('model-status-text').textContent = `AI Credit Risk Engine (${data.model_performance.accuracy}% Accuracy)`;

      renderCharts(data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  }

  function renderCharts(data) {
    // 1. Purpose Chart (Luxury Donut Chart)
    const ctxPurpose = document.getElementById('chart-purpose');
    if (ctxPurpose) {
      if (chartPurpose) chartPurpose.destroy();
      const pLabels = Object.keys(data.dataset_summary.purpose_distribution);
      const pData = Object.values(data.dataset_summary.purpose_distribution);

      chartPurpose = new Chart(ctxPurpose, {
        type: 'doughnut',
        data: {
          labels: pLabels,
          datasets: [{
            data: pData,
            backgroundColor: ['#059669', '#D97706', '#4F46E5', '#0284C7', '#E11D48'],
            borderWidth: 3,
            borderColor: '#FFFFFF',
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: '#334155',
                padding: 14,
                font: { family: 'Outfit', weight: '600', size: 12 },
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: commonTooltipOptions
          }
        }
      });
    }

    // 2. Credit Score Chart (Gradient Vertical Bar Chart)
    const ctxCredit = document.getElementById('chart-credit');
    if (ctxCredit) {
      if (chartCredit) chartCredit.destroy();
      const cLabels = Object.keys(data.credit_bins);
      const cData = Object.values(data.credit_bins);

      const ctx2d = ctxCredit.getContext('2d');
      const gradient = ctx2d.createLinearGradient(0, 0, 0, 240);
      gradient.addColorStop(0, '#059669');
      gradient.addColorStop(1, '#34D399');

      chartCredit = new Chart(ctxCredit, {
        type: 'bar',
        data: {
          labels: cLabels,
          datasets: [{
            label: 'Applicants',
            data: cData,
            backgroundColor: gradient,
            borderRadius: 8,
            borderSkipped: false,
            barThickness: 36
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: commonTooltipOptions
          },
          scales: {
            x: {
              ticks: { color: '#475569', font: { family: 'Outfit', weight: '600' } },
              grid: { display: false }
            },
            y: {
              ticks: { color: '#475569', font: { family: 'Outfit' } },
              grid: { color: '#E2E8F0', strokeDash: [4, 4] }
            }
          }
        }
      });
    }

    // 3. Feature Importance Chart (Gradient Horizontal Bar Chart with Human Labels)
    const ctxFeatures = document.getElementById('chart-features');
    if (ctxFeatures) {
      if (chartFeatures) chartFeatures.destroy();
      const top6 = data.top_features.slice(0, 6);
      const fLabels = top6.map(f => {
        const rawName = f.feature.replace('num__', '').replace('cat__', '');
        return featureNameMap[rawName] || rawName;
      });
      const fData = top6.map(f => (f.importance * 100).toFixed(1));

      const ctx2d = ctxFeatures.getContext('2d');
      const gradientHex = ctx2d.createLinearGradient(0, 0, 300, 0);
      gradientHex.addColorStop(0, '#D97706');
      gradientHex.addColorStop(1, '#FBBF24');

      chartFeatures = new Chart(ctxFeatures, {
        type: 'bar',
        data: {
          labels: fLabels,
          datasets: [{
            label: 'Weight Impact (%)',
            data: fData,
            backgroundColor: gradientHex,
            borderRadius: 6,
            barThickness: 20
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              ...commonTooltipOptions,
              callbacks: {
                label: (context) => ` Impact Weight: ${context.parsed.x}%`
              }
            }
          },
          scales: {
            x: {
              ticks: {
                color: '#475569',
                font: { family: 'Outfit' },
                callback: (val) => `${val}%`
              },
              grid: { color: '#E2E8F0' }
            },
            y: {
              ticks: { color: '#334155', font: { family: 'Outfit', weight: '600' } },
              grid: { display: false }
            }
          }
        }
      });
    }

    // 4. DTI Chart (Color-Coded Risk Doughnut)
    const ctxDTI = document.getElementById('chart-dti');
    if (ctxDTI) {
      if (chartDTI) chartDTI.destroy();
      const dLabels = Object.keys(data.dti_bins);
      const dData = Object.values(data.dti_bins);

      chartDTI = new Chart(ctxDTI, {
        type: 'doughnut',
        data: {
          labels: dLabels,
          datasets: [{
            data: dData,
            backgroundColor: ['#059669', '#D97706', '#E11D48'],
            borderWidth: 3,
            borderColor: '#FFFFFF',
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: '#334155',
                padding: 14,
                font: { family: 'Outfit', weight: '600', size: 12 },
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: commonTooltipOptions
          }
        }
      });
    }
  }

  // ==================== APPLICANTS DATABASE TABLE ====================
  function initApplicantsTable() {
    const searchInput = document.getElementById('table-search');
    const filterStatus = document.getElementById('filter-status');
    const filterPurpose = document.getElementById('filter-purpose');
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');

    if (searchInput) searchInput.addEventListener('input', () => { currentApplicantPage = 1; fetchApplicantRecords(); });
    if (filterStatus) filterStatus.addEventListener('change', () => { currentApplicantPage = 1; fetchApplicantRecords(); });
    if (filterPurpose) filterPurpose.addEventListener('change', () => { currentApplicantPage = 1; fetchApplicantRecords(); });

    if (btnPrev) btnPrev.addEventListener('click', () => { if (currentApplicantPage > 1) { currentApplicantPage--; fetchApplicantRecords(); } });
    if (btnNext) btnNext.addEventListener('click', () => { currentApplicantPage++; fetchApplicantRecords(); });
  }

  async function fetchApplicantRecords() {
    const tbody = document.getElementById('applicant-table-body');
    if (!tbody) return;

    const search = document.getElementById('table-search').value;
    const status = document.getElementById('filter-status').value;
    const purpose = document.getElementById('filter-purpose').value;

    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading records...</td></tr>`;

    try {
      const url = `/api/applicants?page=${currentApplicantPage}&limit=${applicantLimit}&search=${encodeURIComponent(search)}&status=${status}&purpose=${purpose}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load dataset records');

      const data = await response.json();

      tbody.innerHTML = '';
      if (data.applicants.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px; color: var(--text-light);">No records found matching criteria.</td></tr>`;
        return;
      }

      data.applicants.forEach(app => {
        const tr = document.createElement('tr');
        const isApproved = String(app.Loan_Approved).toLowerCase() === 'yes';
        const badgeClass = isApproved ? 'approved' : 'rejected';
        const statusText = isApproved ? 'Approved' : 'Rejected';

        tr.innerHTML = `
          <td style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--emerald-900);">#${app.Applicant_ID || 'N/A'}</td>
          <td style="font-weight: 700;">₹${app.Applicant_Income ? app.Applicant_Income.toLocaleString() : '0'}</td>
          <td><span style="color: ${app.Credit_Score >= 700 ? 'var(--emerald-600)' : app.Credit_Score >= 600 ? 'var(--gold-600)' : 'var(--rose-600)'}; font-weight: 700;">${app.Credit_Score || 'N/A'}</span></td>
          <td>${app.DTI_Ratio ? (app.DTI_Ratio * 100).toFixed(1) + '%' : 'N/A'}</td>
          <td>₹${app.Loan_Amount ? app.Loan_Amount.toLocaleString() : '0'}</td>
          <td>${app.Loan_Term ? app.Loan_Term + ' mos' : 'N/A'}</td>
          <td>${app.Loan_Purpose || 'N/A'}</td>
          <td>${app.Employment_Status || 'N/A'}</td>
          <td><span class="badge-status ${badgeClass}">${statusText}</span></td>
        `;
        tbody.appendChild(tr);
      });

      // Pagination info & buttons
      document.getElementById('page-info').textContent = `Showing Page ${data.page} of ${data.total_pages} (${data.total_records.toLocaleString()} Total Records)`;
      document.getElementById('btn-prev-page').disabled = (data.page <= 1);
      document.getElementById('btn-next-page').disabled = (data.page >= data.total_pages);

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color: var(--rose-600); padding: 20px;">Error: ${err.message}</td></tr>`;
    }
  }

  // ==================== SIMULATOR CALCULATOR ====================
  function initSimulator() {
    const amtInput = document.getElementById('sim-amount');
    const rateInput = document.getElementById('sim-rate');
    const tenureInput = document.getElementById('sim-tenure');

    if (!amtInput) return;

    [amtInput, rateInput, tenureInput].forEach(inp => {
      inp.addEventListener('input', updateSimulator);
    });

    updateSimulator();
  }

  function updateSimulator() {
    const amt = parseFloat(document.getElementById('sim-amount').value);
    const rate = parseFloat(document.getElementById('sim-rate').value);
    const tenure = parseFloat(document.getElementById('sim-tenure').value);

    document.getElementById('sim-val-amount').textContent = `₹${amt.toLocaleString()}`;
    document.getElementById('sim-val-rate').textContent = `${rate.toFixed(1)}%`;
    document.getElementById('sim-val-tenure').textContent = `${tenure} Months`;

    const monthlyRate = (rate / 100) / 12;
    const emi = (amt * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / (Math.pow(1 + monthlyRate, tenure) - 1);
    const totalPayment = emi * tenure;
    const totalInterest = totalPayment - amt;

    document.getElementById('sim-res-emi').textContent = `₹${emi.toFixed(2)}`;
    document.getElementById('sim-res-principal').textContent = `₹${amt.toLocaleString()}`;
    document.getElementById('sim-res-interest').textContent = `₹${totalInterest.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
    document.getElementById('sim-res-total').textContent = `₹${totalPayment.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
  }

});
