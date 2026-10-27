# Cloud-Native Market Regime Detection and Adaptive Portfolio Risk Engine

> **Cloud Computing & DevOps (CCD) Mini-Project**  
> **Department of Computer Science & Engineering** | Academic Year: 2026–2027 | 5th Semester  
> **Batch:** D2 | **Section:** D  

[![CI/CD Pipeline](https://github.com/nxndinisxh/ccdl-mini/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/nxndinisxh/ccdl-mini/actions)
[![Infrastructure as Code](https://img.shields.io/badge/IaC-HashiCorp%20Terraform-7B42BC.svg)](terraform/)
[![Cloud Provider](https://img.shields.io/badge/Cloud-AWS%20Serverless-FF9900.svg)](https://aws.amazon.com)
[![Free Tier Cost](https://img.shields.io/badge/Monthly%20Cost-%240.00%20(Always%20Free)-success.svg)](#cloud-economics--aws-free-tier-compliance)
[![Tests Passing](https://img.shields.io/badge/Tests-7%20Passed-brightgreen.svg)](backend/test_engine.py)

---

## 📌 Project Overview

Financial markets transition dynamically across different economic conditions (such as low-volatility growth, speculative rallies, sideways consolidations, and high-volatility crashes). Conventional portfolio analysis evaluates risk using static historical averages without adapting to changing market regimes.

This project delivers an end-to-end, event-driven, cloud-native quantitative platform that:
1. Ingests streaming & historical market data across global benchmarks (S&P 500, NASDAQ, Gold, US Treasuries, Bitcoin).
2. Computes mathematical indicators (log returns, rolling annualized volatility, SMA trend ratios, EMA spreads, RSI).
3. Classifies prevailing market conditions into 4 distinct regimes using an **unsupervised $K$-Means clustering algorithm** with deterministic semantic centroid mapping.
4. Generates a composite **Portfolio Risk Score (0–100)**, calculates tail risk metrics (VaR 95/99%, Expected Shortfall CVaR, Max Drawdown), and produces **adaptive asset allocation recommendations**.
5. Dispatches real-time alerts via **Amazon SNS** when high-risk regime shifts occur.
6. Operates **strictly under the \$0.00 AWS Free Plan** with an automated **AWS Budget Alert set to \$0.01**.

---

## 🏛️ Cloud & DevOps Architecture

```
                                  AWS CLOUD REGION
  ┌──────────────────┐         Raw OHLCV         ┌───────────────────────────────┐
  │ yfinance Market  │ ────────────────────────> │ Amazon S3 Bucket              │
  │ Ingestion Worker │                           │ (market-data-prod)            │
  └────────┬─────────┘                           └───────────────────────────────┘
           │
           │ Ingestion Event
           ▼
  ┌──────────────────┐         SQS Trigger       ┌───────────────────────────────┐
  │ Amazon SQS Queue │ ────────────────────────> │ AWS Lambda Worker             │
  │ (ingestion-queue)│                           │ (Feature Eng + K-Means + Risk)│
  └────────┬─────────┘                           └───────────────┬───────────────┘
           │ Dead-Letter Queue (3 retries)                       │
           ▼                                      ┌──────────────┴───────────────┐
  ┌──────────────────┐                            │                              │
  │ SQS DLQ Queue    │                     State  ▼                         Alert▼
  └──────────────────┘                   ┌─────────────────┐            ┌──────────────┐
                                         │ Amazon DynamoDB │            │  Amazon SNS  │
                                         │ (MarketRegimes) │            │ (Alert Topic)│
                                         └────────┬────────┘            └──────┬───────┘
                                                  │                            │ Email
                                        REST Read │                            ▼
  ┌──────────────────┐   Proxy Routing   ┌────────┴────────┐            ┌──────────────┐
  │ React/Vite Web   │ <──────────────── │ Amazon API GW   │            │ Stakeholder  │
  │ Dashboard Client │                   │ (HTTP API v2)   │            │ Alerts       │
  └──────────────────┘                   └─────────────────┘            └──────────────┘
```

---

## 💰 Cloud Economics & AWS Free Tier Compliance ($0.00 / Month)

Every service utilized was intentionally selected and configured within the **AWS Always Free Tier**:

| AWS Service | Free Tier Allowance | Project Consumption | Monthly Cost |
| :--- | :--- | :--- | :---: |
| **AWS Lambda** | 1,000,000 invocations / mo | ~15,000 invocations / mo | **\$0.00** |
| **Amazon SQS** | 1,000,000 standard requests / mo | ~45,000 requests / mo (10s long polling) | **\$0.00** |
| **Amazon SNS** | 1,000,000 publishes / mo | < 500 regime alert notifications / mo | **\$0.00** |
| **Amazon DynamoDB** | 25 RCU / 25 WCU + 25 GB storage | Provisioned at 5 RCU / 5 WCU (< 50 MB) | **\$0.00** |
| **Amazon S3** | 5 GB standard storage | ~120 MB raw data storage | **\$0.00** |
| **API Gateway** | 1,000,000 HTTP API requests / mo | ~20,000 dashboard requests / mo | **\$0.00** |
| **AWS Budgets** | Free tier budget alarm | 1 active alarm (\$0.01 threshold) | **\$0.00** |
| **Total Incurred** | — | — | **\$0.00** |

---

## 🚀 Quickstart & Local Demonstration

### Option 1: Run the Complete Platform Locally (1 Command)
You can launch the full backend REST API and the interactive dashboard with Python:

```bash
cd backend
python main.py
```
Then open your browser to **[http://localhost:8000](http://localhost:8000)**!

### Option 2: Run Automated Unit Tests (Pytest)
Execute the comprehensive mathematical and pipeline test suite:

```bash
cd backend
pytest test_engine.py -v
```
*(All 7 tests verify RSI bounds, feature extraction, K-Means clustering, VaR/CVaR calculations, asset allocation weights, composite risk score bounds, and worker pipeline).*

### Option 3: Verify Infrastructure as Code (Terraform)
Validate the Terraform cloud infrastructure manifests:

```bash
cd terraform
terraform init -backend=false
terraform validate
```

---

## 🔬 Live Demo Features (For Professor Presentation)

1. **Active Regime Badge & Color Coding**:
   - `Low-Volatility Bullish` (Emerald Green): 80% Equities / 15% Bonds / 5% Cash
   - `High-Volatility Bullish` (Cyan): 55% Equities / 30% Bonds / 15% Cash
   - `Sideways / Neutral` (Slate): 40% Equities / 40% Bonds / 20% Cash
   - `High-Volatility Bearish` (Rose Red): 15% Equities / 35% Bonds / 50% Cash
2. **Interactive HTML5 Canvas Timeline**: Plots the daily historical closing price color-coded by the detected regime.
3. **Simulate Shock (-5% Stress Test) Button**:
   - Injects an instant market crash into the live asset series.
   - Shows the unsupervised model immediately shifting to **High-Volatility Bearish**.
   - Shows the portfolio allocation automatically derisking to 50% cash.
   - Triggers the simulated **Amazon SNS Alert Notification banner**!

---

## 📁 Repository Structure

```
ccdl-mini-project/
├── backend/
│   ├── ingestion.py          # Market data collector & S3/SQS cloud connector
│   ├── features.py           # Mathematical feature engineering (returns, vol, RSI, SMA)
│   ├── regime_engine.py      # Unsupervised K-Means clustering & semantic centroid mapper
│   ├── risk_engine.py        # VaR (95%/99%), CVaR, MDD, Sharpe, dynamic asset weights
│   ├── worker.py             # AWS Lambda event handler & SQS message dispatcher
│   ├── main.py               # FastAPI server & REST API
│   ├── test_engine.py        # Pytest unit and integration test suite
│   ├── requirements.txt      # Python dependencies
│   └── Dockerfile            # Multi-stage container build
├── frontend/
│   ├── index.html            # Vite entrypoint with IBM Plex fonts
│   ├── src/                  # React 18 application (App.jsx, main.jsx, index.css)
│   ├── package.json          # React, Tailwind, Recharts, Lucide dependencies
│   ├── vite.config.js        # Vite config with API reverse proxy
│   └── Dockerfile            # Multi-stage production container (Node build + Nginx)
├── terraform/
│   ├── main.tf               # S3, SQS, SNS, DynamoDB, CloudWatch, AWS Budget alarm
│   ├── lambda.tf             # IAM execution roles and Lambda serverless worker
│   ├── api_gateway.tf        # HTTP API v2 routes and proxy integrations
│   ├── variables.tf          # Configurable deployment inputs
│   ├── outputs.tf            # Cloud endpoint and ARN outputs
│   └── terraform.tfvars.example
├── .github/workflows/
│   └── ci-cd.yml             # GitHub Actions CI/CD pipeline
├── docs/
│   └── TECHNICAL_DESIGN_DOCUMENT.md   # Comprehensive technical design document
├── docker-compose.yml        # Multi-container orchestration
└── README.md                 # Complete documentation
```
