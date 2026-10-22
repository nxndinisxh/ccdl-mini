# Technical Design Document: Cloud-Native Market Regime Detection & Adaptive Portfolio Risk Engine

**Course:** Cloud Computing & DevOps (Mini-Project)  
**Academic Year:** 2026–2027 | Semester: 5th | Section: D | Batch: D2  
**Department:** School of Computer Engineering  
**Supervisors:** Dr. Anup Bhat & Dr. Swati B P  
**Team Members:**
- **Nandini Sah** (Reg. No.: 240905552, Roll: 54, CSE D)
- **Prisha Gupta** (Reg. No.: 240905612, Roll: 61, CSE D)

---

## 1. Introduction

Financial asset markets exhibit dynamic, non-stationary structural behaviors. Economic macro-cycles, regulatory shifts, liquidity shocks, and geopolitical disruptions cause markets to transition across fundamentally distinct operational regimes—ranging from calm, trending bull markets to highly volatile liquidity contractions and market crashes.

Traditional static portfolio risk management systems typically compute risk metrics (e.g., standard deviation, Value-at-Risk) over historical lookback windows under the flawed assumption of independent and identically distributed (i.i.d.) Gaussian returns. This structural ignorance leaves investment portfolios exposed to severe tail-risk events when the market transitions from a benign low-volatility environment to a volatile liquidation spiral.

At the enterprise level, building quantitative systems capable of processing streaming market ticks, computing high-dimensional mathematical features, executing unsupervised machine learning inference, and dynamically recalculating portfolio asset weights requires a scalable, fault-tolerant, and automated cloud computing infrastructure.

This project delivers the **Cloud-Native Market Regime Detection and Adaptive Portfolio Risk Engine**: an end-to-end, event-driven quantitative platform engineered strictly under the **AWS Free Tier / Free Plan**, provisioned through Infrastructure as Code (Terraform), continuously integrated and verified via GitHub Actions, and containerized with Docker.

---

## 2. Problem Statement

Financial risk management and quantitative cloud systems face three interdependent challenges:

1. **Analytical Regime Blindness**: Static asset allocation models fail to account for structural market state transitions. A strategy optimized for low-volatility trend expansion can incur catastrophic drawdowns during volatility spikes unless equity exposure is automatically throttled.
2. **Infrastructure Complexity and Operational Inefficiency**: Data ingestion, feature engineering, machine learning clustering, and risk scoring pipelines are frequently implemented as monolithic, manually managed batch scripts. This leads to configuration drift, deployment latency, lack of observability, and compute under-utilization.
3. **Cloud Cost Barriers & Resource Waste**: Deploying always-on virtual machines (EC2) or unmanaged relational databases for intermittent financial computation generates unnecessary cloud costs. There is an urgent industry and academic need to architect serverless, event-driven pipelines that scale to zero when idle, preserving strict \$0.00 operational budgets while meeting institutional performance and reliability benchmarks.

---

## 3. Solution Architecture

The solution addresses these challenges through a fully decoupled, serverless, and event-driven cloud architecture deployed on Amazon Web Services (AWS):

```
+-----------------------------------------------------------------------------------+
|                                  AWS CLOUD REGION                                 |
|                                                                                   |
|  +--------------------+         Raw Ticks         +----------------------------+  |
|  | yfinance Market    | ------------------------> | Amazon S3 Bucket           |  |
|  | Ingestion Worker   |                           | (market-data-prod)         |  |
|  +--------------------+                           +----------------------------+  |
|            |                                                                      |
|            | Ingestion Event Notification                                         |
|            v                                                                      |
|  +--------------------+         Trigger           +----------------------------+  |
|  | Amazon SQS Queue   | ------------------------> | AWS Lambda Worker          |  |
|  | (ingestion-queue)  |                           | (K-Means & Risk Engine)    |  |
|  +--------------------+                           +----------------------------+  |
|            ^                                                |              |      |
|            | DLQ (3 retries)                                | State        | Alert|
|  +--------------------+                                     v              v      |
|  | SQS Dead-Letter Q  |                         +---------------+  +------------+ |
|  +--------------------+                         |Amazon DynamoDB|  | Amazon SNS | |
|                                                 |MarketRegimes  |  | Topic      | |
|                                                 +---------------+  +------------+ |
|                                                         |                 |       |
|                                                         | REST Read       | Email |
|  +--------------------+        API Proxy        +---------------+         v       |
|  | React/Vite Web     | <---------------------- | Amazon API    |     +---------+ |
|  | Dashboard Client   |                         | Gateway HTTP  |     |Investor | |
|  +--------------------+                         +---------------+     |Alerts   | |
|                                                                       +---------+ |
+-----------------------------------------------------------------------------------+
```

### Architectural Highlights
- **Decoupled Asynchrony**: Ingestion workers publish tasks to **Amazon SQS** without blocking analytical consumers.
- **Serverless Event-Driven Compute**: **AWS Lambda** automatically executes upon SQS queue events, scaling dynamically from 0 to concurrent instances and returning to zero cost.
- **Predictable Provisioned NoSQL State**: **Amazon DynamoDB** stores historical regime states and risk evaluations under provisioned throughput (5 RCU / 5 WCU), guaranteeing Always Free tier compliance.
- **Proactive Tail-Risk Notification**: When a high-volatility bearish regime or risk score exceeding 75/100 is detected, **Amazon SNS** publishes immediate alerts to subscribed stakeholders.
- **Zero-Cost Free Tier Safeguard**: **AWS Budgets** monitors actual and forecasted monthly expenditures, firing automated webhook/email alarms at a \$0.01 threshold.

---

## 4. Application Architecture

The software stack comprises three primary decoupled software layers:

```
ccdl-mini-project/
├── backend/
│   ├── ingestion.py       # Yahoo Finance collector & S3/SQS cloud connector
│   ├── features.py        # Log returns, rolling volatility, RSI, SMA trend ratios
│   ├── regime_engine.py   # Unsupervised K-Means clustering & semantic centroid mapper
│   ├── risk_engine.py     # VaR (95%/99%), CVaR, MDD, Sharpe, dynamic asset weights
│   ├── worker.py          # AWS Lambda event handler & SQS message dispatcher
│   ├── main.py            # FastAPI REST application & interactive endpoints
│   ├── test_engine.py     # Automated Pytest unit and integration test suite
│   ├── requirements.txt   # Pinned Python package dependencies
│   └── Dockerfile         # Multi-stage container build
├── frontend/
│   ├── index.html         # Responsive, dark-mode single-page quantitative dashboard
│   ├── app.js             # Canvas timeline visualizer, real-time state manager
│   ├── styles.css         # Modern styling, responsive layout, glowing indicators
│   └── Dockerfile         # Lightweight Nginx container
├── terraform/
│   ├── main.tf            # S3, SQS, SNS, DynamoDB, CloudWatch, AWS Budget alarm
│   ├── lambda.tf          # IAM execution roles and Lambda serverless workers
│   ├── api_gateway.tf     # HTTP API v2 routes and proxy integrations
│   ├── variables.tf       # Configurable deployment inputs
│   └── outputs.tf         # Cloud endpoint and ARN outputs
└── .github/workflows/
    └── ci-cd.yml          # Automated CI/CD pipeline (Test, Lint, IaC Validate, Docker)
```

---

## 5. Technical Designs

### 5.1 Mathematical Feature Engineering

The feature extraction pipeline ingests daily adjusted closing prices $P_t$ and trading volume $V_t$ across a lookback horizon $T$, generating normalized feature representations:

1. **Logarithmic Returns**:
   $$r_t = \ln\left(\frac{P_t}{P_{t-1}}\right)$$

2. **Annualized Rolling Volatility (21-day trading window)**:
   $$\sigma_t = \sqrt{252} \cdot \sqrt{\frac{1}{N-1} \sum_{i=0}^{N-1} (r_{t-i} - \bar{r}_t)^2}, \quad N = 21$$

3. **Trend Deviation (50-day Simple Moving Average Ratio)**:
   $$\text{SMA}_{50}(t) = \frac{1}{50} \sum_{i=0}^{49} P_{t-i}, \quad \tau_t = \frac{P_t - \text{SMA}_{50}(t)}{\text{SMA}_{50}(t)}$$

4. **Moving Average Spread (EMA-20 vs. SMA-50)**:
   $$\text{EMA}_{20}(t) = \alpha P_t + (1-\alpha) \text{EMA}_{20}(t-1), \quad \alpha = \frac{2}{21}$$
   $$\Delta_{\text{EMA}}(t) = \frac{\text{EMA}_{20}(t) - \text{SMA}_{50}(t)}{\text{SMA}_{50}(t)}$$

5. **Relative Strength Index (RSI-14)**:
   $$\text{RS} = \frac{\text{EMA}_{14}(\text{Upward Price Changes})}{\text{EMA}_{14}(\text{Downward Price Changes})}, \quad \text{RSI}_t = 100 - \frac{100}{1 + \text{RS}}$$

### 5.2 Unsupervised K-Means Regime Detection Model

Standardized feature vectors $\mathbf{x}_t \in \mathbb{R}^5$ are partitioned into $K = 4$ clusters by minimizing within-cluster sum of squares:

$$J = \sum_{k=1}^{K} \sum_{\mathbf{x} \in C_k} \|\mathbf{x} - \boldsymbol{\mu}_k\|^2$$

#### Semantic Centroid Mapping Heuristic
Because unsupervised K-Means generates arbitrary cluster index permutations $(0, 1, \dots, K-1)$, the model maps centroids back into physical economic space using an automated centroid sorting algorithm:
- Lowest return + elevated volatility $\rightarrow$ **High-Volatility Bearish**
- Highest volatility among remaining $\rightarrow$ **High-Volatility Bullish**
- Positive trend ratio + moderate volatility $\rightarrow$ **Low-Volatility Bullish**
- Flat trend ratio + subdued volatility $\rightarrow$ **Sideways / Neutral**

### 5.3 Adaptive Quantitative Risk Engine

#### Value at Risk (VaR) & Expected Shortfall (CVaR)
Historical Value-at-Risk at confidence level $\alpha \in \{0.95, 0.99\}$ is formulated as:

$$\text{VaR}_\alpha = - \inf \{ l \in \mathbb{R} : F_L(l) \ge \alpha \}$$

Expected Shortfall (CVaR) computes tail expectation conditional on exceeding the VaR boundary:

$$\text{CVaR}_\alpha = \mathbb{E}[L \mid L \ge \text{VaR}_\alpha]$$

#### Composite Risk Score Formulation ($0 \le S \le 100$)
$$S = 0.40 \cdot S_{\text{regime}} + 0.25 \cdot S_{\text{vol}} + 0.20 \cdot S_{\text{VaR}} + 0.15 \cdot S_{\text{MDD}}$$

#### Regime-Adaptive Asset Allocation Matrix

| Regime | Equities (%) | Fixed Income / Bonds (%) | Cash & Hedges (%) | Strategic Stance |
| :--- | :---: | :---: | :---: | :--- |
| **Low-Volatility Bullish** | 80% | 15% | 5% | Aggressive Growth / Trend Following |
| **High-Volatility Bullish** | 55% | 30% | 15% | Cautious Momentum / Volatility Hedge |
| **Sideways / Neutral** | 40% | 40% | 20% | Market-Neutral / Income Generation |
| **High-Volatility Bearish** | 15% | 35% | 50% | Capital Preservation / Maximum Liquidity |

### 5.4 Infrastructure as Code (Terraform)
All AWS resources are defined declaratively in Terraform:
- Zero manual console configurations.
- Enforced encryption and private bucket policies.
- SQS dead-letter queues configured with 3-retry redrive policies.
- Strict provisioned throughput on DynamoDB to prevent accidental on-demand cost surges.
- AWS Budget alarm at \$0.01 threshold.

### 5.5 CI/CD Pipeline (GitHub Actions)
On every pull request and push to the default branch, GitHub Actions executes:
1. `test-and-lint`: Automated unit testing via `pytest` ensuring 100% test pass rate across mathematical formulations and bounds.
2. `terraform-quality`: Formats and executes `terraform validate` to guarantee infrastructure syntax integrity.
3. `container-build-check`: Verifies backend and frontend Docker builds for reproducible deployment.

---

## 6. Lessons Learned

1. **Serverless Cost Governance**: Serverless architectures (Lambda, API Gateway, DynamoDB) offer superior cost efficiency for variable analytical workloads, but strict provisioned controls and long-polling on SQS queues are essential to eliminate empty-receive polling surcharges.
2. **Determinism in Unsupervised ML**: Unsupervised algorithms (such as K-Means) require deterministic semantic mapping layers to link arbitrary mathematical cluster indices to actionable, real-world business decisions reliably.
3. **Graceful Degradation Patterns**: Integrating synthetic fallback generators into ingestion layers ensures that localized network outages or upstream rate limits do not break critical downstream CI/CD pipelines or live demonstration capabilities.
4. **DevOps Automation Value**: Codifying infrastructure through Terraform and automating checks via GitHub Actions completely eliminated "works on my machine" discrepancies between development environments and production deployment targets.

---

## 7. Individual Contributions

In accordance with course mini-project guidelines, the team responsibilities were distributed as follows:

### Nandini Sah (Reg. No.: 240905552)
- **Primary Focus Areas:** Cloud Architecture, Infrastructure as Code, CI/CD, and Backend API Services.
- **Key Deliverables:**
  - Designed and authored the Terraform infrastructure scripts (`main.tf`, `lambda.tf`, `api_gateway.tf`, `variables.tf`, `outputs.tf`).
  - Configured AWS S3, SQS, SNS alerting, and DynamoDB table schemas with provisioned free-tier limits.
  - Implemented the AWS Budget \$0.01 threshold zero-cost safeguard.
  - Engineered the GitHub Actions continuous integration workflow (`ci-cd.yml`).
  - Developed the FastAPI server application (`main.py`) and Docker container configuration.

### Prisha Gupta (Reg. No.: 240905612)
- **Primary Focus Areas:** Quantitative Feature Engineering, Unsupervised Machine Learning, Portfolio Risk Engine, and Frontend Visualization.
- **Key Deliverables:**
  - Formulated and implemented the market feature extraction algorithms (`features.py`: log returns, rolling volatility, RSI, SMA ratios).
  - Designed the unsupervised K-Means market regime detection engine and semantic centroid mapping algorithm (`regime_engine.py`).
  - Implemented the quantitative portfolio risk metrics (`risk_engine.py`: VaR 95/99%, Expected Shortfall, Drawdown, and dynamic allocation weights).
  - Developed the responsive web dashboard (`index.html`, `app.js`, `styles.css`) including the interactive canvas historical regime visualizer and crash simulation stress-testing module.
  - Co-authored unit and integration test suites in `test_engine.py`.

---

## 8. Source Repository Link & Structure

- **Repository Link:** `https://github.com/nxndinisxh/ccdl-mini.git`
- **Root Directory Structure:**
  - `/backend`: Core Python microservice, ML engine, and test suite.
  - `/frontend`: Web dashboard UI and canvas visualization engine.
  - `/terraform`: Infrastructure as Code specifications.
  - `/.github/workflows`: Automated CI/CD pipeline definitions.
  - `/docs`: Technical Design Document and Research Paper.
  - `docker-compose.yml`: Multi-container local orchestration.
  - `README.md`: Quickstart deployment guide.
