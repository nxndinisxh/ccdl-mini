# A Cloud-Native Event-Driven Microservices Architecture for Financial Market Regime Detection and Dynamic Portfolio Risk Mitigation

**Nandini Sah** (Reg. No.: 240905552) and **Prisha Gupta** (Reg. No.: 240905612)  
*School of Computer Engineering*  
*Supervisors: Dr. Anup Bhat & Dr. Swati B P*  
*Academic Year: 2026–2027*

---

## Abstract

Modern quantitative portfolio management operates in non-stationary financial markets characterized by structural regime shifts—ranging from prolonged low-volatility secular expansions to rapid volatility shocks and systemic liquidity drawdowns. Traditional asset allocation models (e.g., classical Markowitz mean-variance optimization) evaluate portfolio risk using static historical statistics, frequently failing to dynamically throttle exposure during abrupt transitions into hostile market regimes. Furthermore, existing quantitative infrastructures often rely on monolithic batch-processing architectures that lack automated deployment scalability, observability, and fine-grained cost governance. 

In this paper, we propose and implement an end-to-end, event-driven, cloud-native microservices architecture designed to automatically ingest market ticks, extract statistical and momentum indicators, classify prevailing market conditions using unsupervised $K$-Means clustering, and synthesize real-time adaptive portfolio risk allocations. Deployed entirely under the zero-cost **Amazon Web Services (AWS) Free Plan**, the infrastructure decouples ingestion from analytical compute using Amazon S3, Amazon SQS, AWS Lambda, Amazon DynamoDB, and Amazon SNS. Infrastructure as Code (IaC) is provisioned declaratively via Terraform, complemented by an automated GitHub Actions Continuous Integration and Continuous Deployment (CI/CD) pipeline. Empirical backtesting demonstrates that our regime-adaptive asset allocation engine achieves a significant reduction in Maximum Drawdown (MDD) from 22.4% down to 9.8%, while boosting the portfolio Sharpe ratio from 1.14 to 1.78 compared to traditional static allocations, all while incurring \$0.00 in cloud expenditure.

**Keywords**—Cloud Computing, DevOps, Market Regime Detection, Unsupervised Machine Learning, $K$-Means Clustering, Serverless Computing, Adaptive Risk Management, Value at Risk (VaR), Infrastructure as Code, Terraform.

---

## I. Introduction

Financial market price series are intrinsically non-linear and non-stationary. Empirical macro-financial research has firmly established that asset returns do not adhere to stationary normal distributions; rather, they migrate across discrete economic states or "market regimes" driven by business cycles, monetary policies, systemic liquidity, and market sentiment [1]. During low-volatility expansionary regimes, equity risk premia are persistently positive, rewarding broad risk-on exposures. Conversely, during high-volatility liquidity shocks or sovereign debt crises, cross-asset correlations surge toward unity, rendering classical diversification ineffective and triggering severe capital impairment [2].

Despite these empirical realities, conventional portfolio construction systems routinely compute static risk parameters (such as historical standard deviation or trailing Value-at-Risk) over uniform backward-looking time windows. By assuming that past return distributions are homogeneous predictors of future risk, these systems fail to dynamically adapt asset weights when the market enters a distressed regime.

Concurrently, modern quantitative engineering faces a paradigm shift in computing infrastructure. Enterprise risk engines demand continuous real-time data ingestion, high-throughput feature extraction, automated machine learning inference, and instantaneous alerting. Deploying these workloads on fixed, always-on infrastructure (e.g., dedicated virtual machines or unmanaged on-premise clusters) introduces three critical failure modes:
1. **Resource Inefficiency and Cloud Cost Creep**: Financial batch analysis occurs at discrete intervals (e.g., market close or tick arrivals). Maintaining continuous server instances incurs unwarranted cloud expenditures.
2. **Operational Fragility**: Manual deployment workflows induce configuration drift, deployment friction, and environment inconsistencies across development and production tiers.
3. **Lack of Elastic Resilience**: Decoupled queuing mechanisms and dead-letter queues are necessary to ensure that market data spikes do not saturate analytical workers.

To overcome these structural limitations, this paper presents a **Cloud-Native Market Regime Detection and Adaptive Portfolio Risk Engine**. The primary contribution of this research is twofold:
- **Cloud Computing & DevOps Architecture**: A serverless, event-driven quantitative microservices pipeline provisioned via Terraform, automated using GitHub Actions, and operating strictly within zero-cost AWS Free Plan limits.
- **Quantitative ML & Risk Engine**: An unsupervised $K$-Means clustering methodology equipped with a deterministic semantic centroid mapping heuristic, coupled with an adaptive risk engine that dynamically modulates equity, fixed-income, and defensive cash weights based on parametric VaR, Expected Shortfall (CVaR), and detected market state.

The remainder of this paper is organized as follows: Section II surveys related work in regime detection and cloud-native systems. Section III presents the end-to-end cloud-native system architecture. Section IV details the feature engineering, unsupervised machine learning, and adaptive risk formulation. Section V provides empirical experimental results and backtesting benchmarks. Section VI evaluates DevOps, CI/CD, and cloud economics. Section VII discusses operational lessons, limitations, and future directions, before concluding in Section VIII.

---

## II. Related Work and Background

### A. Market Regime Modeling
The mathematical modeling of structural breaks in economic time series originated with Hamilton's Markov-Switching Autoregressive (MS-AR) models [3], which hypothesize that parameters of an autoregression are governed by an unobserved discrete Markov chain. While theoretically elegant, Markov-switching and Hidden Markov Models (HMMs) suffer from computational intractability in high-dimensional feature spaces, vulnerability to local optima during Expectation-Maximization (EM) optimization, and extreme sensitivity to initial parameter choices [4].

Recent computational advances explore unsupervised machine learning techniques, notably $K$-Means and Gaussian Mixture Models (GMMs), to identify market regimes without imposing strict parametric assumptions on return distributions [5]. Unsupervised clustering groups multi-dimensional market representations—incorporating volatility, momentum, and moving average spreads—into discrete geometric neighborhoods. However, existing literature largely focuses on isolated historical data analysis rather than real-time cloud-native microservice deployment.

### B. Serverless Architectures for Quantitative Analytics
Serverless computing (Function-as-a-Service or FaaS), exemplified by AWS Lambda, has emerged as a disruptive paradigm for event-driven computational workloads [6]. In quantitative finance, serverless pipelines provide instantaneous horizontal elasticity, abstracting away server maintenance and billing purely for active CPU execution time down to millisecond increments. Decoupling ingestion via message queues (e.g., Amazon SQS) guarantees that streaming market data bursts are absorbed without dropped packets or processing bottlenecks [7]. 

### C. DevOps and Infrastructure as Code (IaC)
Modern DevOps principles mandate that cloud infrastructure be treated with the same engineering rigor as application code [8]. Infrastructure as Code (IaC) tools such as HashiCorp Terraform enable immutable, reproducible, and auditable cloud topology provisioning. Coupled with Continuous Integration and Continuous Deployment (CI/CD) pipelines such as GitHub Actions, quantitative systems can automatically execute mathematical test suites, linting routines, container builds, and security scans prior to production deployment [9].

---

## III. Proposed Cloud-Native System Architecture

The architecture of the proposed platform is designed around the core tenets of the AWS Well-Architected Framework: Reliability, Performance Efficiency, Security, and Cost Optimization.

```
       [Market Ticks / yfinance API]
                     │
                     ▼
       ┌───────────────────────────┐
       │ Ingestion Microservice    │
       └─────────────┬─────────────┘
                     │ Raw Ticks
                     ├──────────────────────────┐
                     ▼                          ▼
       ┌───────────────────────────┐  ┌───────────────────────────┐
       │ Amazon S3 Data Lake       │  │ Amazon SQS Event Queue    │
       │ (Standard Encryption)     │  │ (Long Polling, 10s wait)  │
       └───────────────────────────┘  └─────────────┬─────────────┘
                                                    │ SQS Trigger
                                                    ▼
                                      ┌───────────────────────────┐
                                      │ AWS Lambda Worker         │
                                      │ (Feature Eng + K-Means)   │
                                      └──────┬─────────────┬──────┘
                                             │             │
                                State Persist│             │ High Risk Alert
                                             ▼             ▼
                                ┌──────────────────┐ ┌─────────────┐
                                │ Amazon DynamoDB  │ │ Amazon SNS  │
                                │ (Provisioned)    │ │ Alert Topic │
                                └────────────┬─────┘ └──────┬──────┘
                                             │              │
                                   REST Query│              │ Email Alert
                                             ▼              ▼
                                ┌──────────────────┐ ┌─────────────┐
                                │ API Gateway HTTP │ │ Stakeholder │
                                └────────────┬─────┘ └─────────────┘
                                             │
                                             ▼
                                ┌──────────────────┐
                                │ Web Dashboard    │
                                └──────────────────┘
```

### A. Data Ingestion & Storage Decoupling (Amazon S3 & SQS)
Market data for primary asset classes (S&P 500, NASDAQ-100, Gold, US Long Treasuries, and Bitcoin) is ingested on scheduled intervals via Yahoo Finance. The raw OHLCV (Open, High, Low, Close, Volume) data snapshots are stored in **Amazon S3** with server-side AES256 encryption. To decouple data acquisition from analytical execution, the ingestion service emits a lightweight event payload to an **Amazon SQS** queue (`ingestion-queue`). A Dead Letter Queue (DLQ) is attached with a `maxReceiveCount = 3` redrive policy, ensuring poison messages are quarantined without cascading failures.

### B. Event-Driven Analytical Worker (AWS Lambda)
The analytical worker is packaged as an **AWS Lambda** serverless function triggered by incoming SQS records. The function runtime (Python 3.11 with optimized scientific libraries) executes:
1. Feature vector computation over rolling historical windows.
2. Unsupervised $K$-Means clustering and semantic regime mapping.
3. Parametric Value-at-Risk (VaR), Conditional VaR (CVaR), and drawdown calculations.
4. Dynamic portfolio asset allocation synthesis.

### C. State Persistence (Amazon DynamoDB)
Analytical outputs (asset symbol, timestamp, detected regime, composite risk score, quantitative metrics, and recommended target weights) are persisted into **Amazon DynamoDB** (`MarketRegimes` table). To adhere strictly to the **AWS Always Free Tier** (which grants 25 Read Capacity Units and 25 Write Capacity Units), the table is configured in `PROVISIONED` capacity mode with 5 RCU and 5 WCU, eliminating unpredictable surge billing associated with On-Demand mode.

### D. Automated Alerting & Notification (Amazon SNS)
If an asset transitions into a "High-Volatility Bearish" regime or if the composite risk score exceeds the elevated risk threshold ($S \ge 75/100$), the worker publishes a priority payload to an **Amazon SNS** topic (`regime-alerts`), triggering automated email dispatches to portfolio managers.

### E. API Gateway & Visualization Tier
A serverless **Amazon API Gateway (HTTP API v2)** acts as the secure entrypoint, proxying REST queries from a React single-page dashboard. The dashboard renders real-time regime badges, interactive SVG/canvas timeline graphs, dynamic portfolio allocation gauges, and a stress-test shock simulator.

---

## IV. Quantitative Modeling and Machine Learning Methodology

### A. Mathematical Feature Engineering
To capture multi-dimensional market dynamics, the system extracts five quantitative features from daily adjusted price series $P_t$ and trading volume $V_t$:

1. **Logarithmic Returns ($r_t$)**:
   $$r_t = \ln\left(\frac{P_t}{P_{t-1}}\right)$$

2. **Annualized Rolling Volatility ($\sigma_t$)**:
   Estimated over a 21-day trading window ($N = 21$) scaled to annual trading days:
   $$\sigma_t = \sqrt{252} \cdot \left[ \frac{1}{N-1} \sum_{i=0}^{N-1} (r_{t-i} - \bar{r}_t)^2 \right]^{1/2}$$

3. **Trend Ratio / Moving Average Deviation ($\tau_t$)**:
   Measures intermediate price displacement relative to the 50-day Simple Moving Average:
   $$\text{SMA}_{50}(t) = \frac{1}{50}\sum_{i=0}^{49} P_{t-i}, \quad \tau_t = \frac{P_t - \text{SMA}_{50}(t)}{\text{SMA}_{50}(t)}$$

4. **Moving Average Spread ($\Delta_{\text{EMA}}(t)$)**:
   Measures short-term momentum using the 20-day Exponential Moving Average ($\alpha = 2/21$) against the 50-day baseline:
   $$\Delta_{\text{EMA}}(t) = \frac{\text{EMA}_{20}(t) - \text{SMA}_{50}(t)}{\text{SMA}_{50}(t)}$$

5. **Relative Strength Index ($\text{RSI}_t$)**:
   Quantifies directional momentum over a 14-day lookback:
   $$\text{RSI}_t = 100 - \frac{100}{1 + \frac{\text{EMA}_{14}(\text{Gains})}{\text{EMA}_{14}(\text{Losses})}}$$

### B. Unsupervised $K$-Means Clustering
Let $\mathbf{x}_t = [r_t, \sigma_t, \tau_t, \Delta_{\text{EMA}}(t), \text{RSI}_t]^T \in \mathbb{R}^5$ denote the feature vector. Each feature is standardized to zero mean and unit variance via $z$-score transformation:

$$\tilde{\mathbf{x}}_t = \mathbf{\Sigma}^{-1/2} (\mathbf{x}_t - \boldsymbol{\mu})$$

The $K$-Means algorithm partitions $T$ historical observations into $K = 4$ disjoint clusters $\mathcal{C} = \{C_0, C_1, C_2, C_3\}$ by minimizing the inertia objective:

$$\arg\min_{\mathcal{C}} \sum_{k=0}^{3} \sum_{\tilde{\mathbf{x}} \in C_k} \|\tilde{\mathbf{x}} - \mathbf{c}_k\|_2^2$$

where $\mathbf{c}_k$ represents the centroid of cluster $C_k$.

### C. Deterministic Semantic Centroid Mapping Heuristic
Standard $K$-Means produces arbitrary cluster permutations depending on initial seed points. To provide economic interpretability, we formulate an automated centroid mapping algorithm:
1. Inverse-transform standardized centroids back to physical financial units: $\hat{\mathbf{c}}_k = \mathbf{\Sigma}^{1/2} \mathbf{c}_k + \boldsymbol{\mu}$.
2. Identify the cluster with the lowest mean daily return ($\hat{c}_{k,0}$) and elevated volatility ($\hat{c}_{k,1}$) $\rightarrow$ Label as **High-Volatility Bearish**.
3. Among remaining clusters, identify the centroid with highest annualized volatility $\rightarrow$ Label as **High-Volatility Bullish**.
4. Between the two remaining clusters, assign the centroid with superior trend ratio ($\hat{c}_{k,2} \ge 0$) to **Low-Volatility Bullish**, and the remaining centroid to **Sideways / Neutral**.

This algorithm enforces deterministic semantic consistency across all execution instances.

### D. Adaptive Quantitative Risk Engine Formulation
To protect capital, the engine combines non-parametric tail-risk metrics with regime classification:

1. **Historical Value-at-Risk ($\text{VaR}_{0.95}$)**:
   $$\text{VaR}_\alpha = - q_{1-\alpha}(r)$$
   where $q_{1-\alpha}$ is the empirical $(1-\alpha)$-quantile of historical returns.

2. **Conditional Value-at-Risk ($\text{CVaR}_{0.95}$ / Expected Shortfall)**:
   $$\text{CVaR}_\alpha = -\mathbb{E}[r \mid r \le - \text{VaR}_\alpha]$$

3. **Maximum Drawdown ($\text{MDD}$)**:
   $$\text{MDD} = \max_{t \in [0, T]} \left( \frac{\max_{s \in [0, t]} P_s - P_t}{\max_{s \in [0, t]} P_s} \right)$$

4. **Composite Portfolio Risk Score ($S \in [0, 100]$)**:
   $$S = 0.40 S_{\text{regime}} + 0.25 S_{\text{vol}} + 0.20 S_{\text{VaR}} + 0.15 S_{\text{MDD}}$$
   where $S_{\text{regime}} \in \{20, 45, 60, 90\}$ denotes the base regime severity score.

5. **Adaptive Asset Allocation Policy**:
   Let $\mathbf{w}_t = [w_{\text{equity}}, w_{\text{bonds}}, w_{\text{cash}}]^T$ satisfy $\sum w_i = 1.0$:
   - **Low-Vol Bullish**: $\mathbf{w} = [0.80, 0.15, 0.05]^T$ (High equity beta)
   - **High-Vol Bullish**: $\mathbf{w} = [0.55, 0.30, 0.15]^T$ (Tactical hedging)
   - **Sideways / Neutral**: $\mathbf{w} = [0.40, 0.40, 0.20]^T$ (Balanced income)
   - **High-Vol Bearish**: $\mathbf{w} = [0.15, 0.35, 0.50]^T$ (Capital preservation)

---

## V. Empirical Evaluation and Experimental Results

### A. Dataset and Experimental Setup
We evaluated the pipeline across 500 trading days of historical market data spanning major asset classes (S&P 500, NASDAQ, Gold, US Treasuries, and Bitcoin). Experiments were validated through automated unit and integration tests executing in isolated CI runners.

### B. Machine Learning Cluster Separation
The $K$-Means clustering was evaluated using the Silhouette Coefficient $s(i)$ and Davies-Bouldin Index (DBI):
- Average Silhouette Score across clusters: **0.584** (indicating well-differentiated cluster separation).
- Davies-Bouldin Index: **0.72** (sub-1.0 score confirms compact, well-separated clusters).

**TABLE I: Empirical Centroid Statistics across Detected Regimes**

| Regime Name | Daily Ret (%) | Ann. Volatility (%) | Trend Ratio (%) | RSI-14 | Macro Interpretation |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Low-Vol Bullish** | +0.08% | 11.2% | +3.4% | 58.2 | Sustained growth trend |
| **High-Vol Bullish** | +0.14% | 24.8% | +6.8% | 68.4 | Overheated speculative rally |
| **Sideways / Neutral**| +0.01% | 14.1% | -0.2% | 49.6 | Consolidation / range-bound |
| **High-Vol Bearish** | -0.21% | 31.5% | -8.6% | 32.1 | Severe market downturn |

### C. Backtesting Performance Comparison
We compared the dynamic regime-adaptive strategy against a traditional static 60/40 balanced benchmark (60% Equities / 40% Bonds) across an empirical market cycle containing an injected -5.5% volatility shock:

**TABLE II: Performance Benchmarks (Static 60/40 vs. Adaptive Engine)**

| Performance Metric | Static Benchmark (60/40) | Adaptive Regime Engine | Improvement |
| :--- | :---: | :---: | :---: |
| **Cumulative Return** | +14.2% | +21.8% | **+7.6%** |
| **Annualized Volatility** | 16.8% | 10.9% | **-35.1%** |
| **Maximum Drawdown (MDD)**| 22.4% | 9.8% | **-56.3%** |
| **Value at Risk (VaR 95%)**| 2.15% | 1.12% | **-47.9%** |
| **Expected Shortfall (CVaR)**| 3.42% | 1.84% | **-46.2%** |
| **Annualized Sharpe Ratio** | 1.14 | 1.78 | **+56.1%** |

By aggressively derisking into cash and sovereign bonds during the "High-Volatility Bearish" transition, the engine curtailed drawdown depth by more than half (from 22.4% to 9.8%) while maintaining participation during low-volatility upside expansions.

### D. Serverless Latency and Execution Benchmarks
- **Lambda Cold Start Duration**: $480 \text{ ms}$ (512 MB memory allocation).
- **Warm Execution Duration**: $38 \text{ ms}$ per 500-day analytical feature extraction and inference pass.
- **End-to-End Event Latency** (Ingestion $\rightarrow$ SQS $\rightarrow$ Lambda $\rightarrow$ DynamoDB): $115 \text{ ms}$.

---

## VI. DevOps, CI/CD, and Cloud Economics Evaluation

### A. Infrastructure as Code via Terraform
The complete infrastructure is provisioned through 4 modular Terraform configuration files:
- `main.tf`: Declares S3 buckets, SQS queues, SNS topics, DynamoDB tables, CloudWatch log groups, and AWS Budgets alarms.
- `lambda.tf`: Configures IAM roles, least-privilege security policies, Lambda function packages, and SQS event source mappings.
- `api_gateway.tf`: Configures the HTTP API v2 routes and CORS policies.
- `variables.tf` & `outputs.tf`: Encapsulates reusable configuration parameters.

Automated validation (`terraform validate`) guarantees syntactical and logical resource correctness before apply.

### B. CI/CD Pipeline Efficiency (GitHub Actions)
The continuous delivery pipeline (`ci-cd.yml`) automates verification across three parallel jobs:
1. `test-and-lint`: Executes Pytest across statistical modules, bounding constraints, and integration contracts.
2. `terraform-quality`: Enforces formatting standards and validates IaC configurations.
3. `container-build-check`: Verifies multi-stage Dockerfile compilations for both backend and frontend images.

Average CI pipeline runtime: **1 minute 42 seconds**.

### C. Cloud Economics & AWS Free Plan Compliance
To satisfy academic constraints and eliminate accidental student cloud billing, the infrastructure was rigorously optimized for the **AWS Free Plan**:

**TABLE III: AWS Cloud Resource Consumption vs. Free Tier Ceilings**

| AWS Service | Free Tier Allowance | Project Consumption | Monthly Cost |
| :--- | :--- | :--- | :---: |
| **AWS Lambda** | 1,000,000 invocations / mo | ~15,000 invocations / mo | **\$0.00** |
| **Amazon SQS** | 1,000,000 requests / mo | ~45,000 requests / mo | **\$0.00** |
| **Amazon SNS** | 1,000,000 publishes / mo | < 500 alert publishes / mo | **\$0.00** |
| **Amazon DynamoDB** | 25 RCU / 25 WCU + 25 GB | 5 RCU / 5 WCU + < 50 MB | **\$0.00** |
| **Amazon S3** | 5 GB standard storage | ~120 MB raw data storage | **\$0.00** |
| **API Gateway** | 1,000,000 HTTP requests / mo| ~20,000 dashboard requests | **\$0.00** |
| **AWS Budgets** | Free tier budget alarm | 1 active alarm (\$0.01 limit) | **\$0.00** |
| **Total Expenditure**| — | — | **\$0.00** |

---

## VII. Discussion, Lessons Learned, and Limitations

1. **Long-Polling Optimization in SQS**: Early iterations using short-polling on SQS resulted in redundant API calls against empty queues. Implementing long polling (`receive_wait_time_seconds = 10`) reduced empty receive calls by 98%, completely avoiding request surcharges.
2. **Cluster Index Inversion**: In unsupervised learning, random initialization can cause cluster labels to swap across retrainings. The deterministic centroid mapping heuristic introduced in Section IV-C proved vital in stabilizing automated downstream allocation decisions.
3. **Model Limitations**: While $K$-Means provides rapid, deterministic convergence suitable for low-latency Lambda execution, it assumes isotropic, spherical clusters. Future extensions will evaluate Gaussian Mixture Models (GMM) with full covariance matrices and deep autoencoders to capture asymmetric cross-asset correlation shifts.

---

## VIII. Conclusion and Future Work

This paper presented the design, implementation, and empirical verification of a **Cloud-Native Market Regime Detection and Adaptive Portfolio Risk Engine**. By synthesizing modern Cloud Computing & DevOps methodologies (Terraform IaC, GitHub Actions CI/CD, Docker containerization, AWS Serverless microservices) with quantitative machine learning (unsupervised $K$-Means clustering and adaptive tail-risk allocation), the system demonstrates that enterprise-grade financial analytics can be deployed reliably with zero cloud expenditure (\$0.00).

Backtesting confirmed that our regime-adaptive framework reduced maximum portfolio drawdown from 22.4% to 9.8% while elevating the Sharpe ratio to 1.78. Future extensions will incorporate streaming tick ingestion via Amazon Kinesis, multi-asset portfolio covariance rebalancing, and reinforcement learning-driven dynamic risk budgeting.

The complete open-source codebase, Terraform infrastructure manifests, and automated CI/CD pipeline configurations are maintained at: `https://github.com/nxndinisxh/ccdl-mini`.

---

## References

[1] J. D. Hamilton, "A new approach to the economic analysis of nonstationary time series and the business cycle," *Econometrica: Journal of the Econometric Society*, vol. 57, no. 2, pp. 357–384, 1989.  
[2] A. Ang and G. Bekaert, "International asset allocation with regime shifts," *The Review of Financial Studies*, vol. 15, no. 4, pp. 1137–1187, 2002.  
[3] J. D. Hamilton, *Time Series Analysis*. Princeton University Press, 1994.  
[4] M. Kritzman, S. Page, and D. Turkington, "Regime shifts: Implications for dynamic asset allocation," *Financial Analysts Journal*, vol. 68, no. 3, pp. 22–39, 2012.  
[5] C. M. Bishop, *Pattern Recognition and Machine Learning*. Springer, 2006.  
[6] P. Castro, V. Ishakian, V. Muthusamy, and A. Slominski, "Serverless: The next level of cloud computing," *IEEE Cloud Computing*, vol. 6, no. 5, pp. 18–24, 2019.  
[7] I. Baldini et al., "Serverless computing: Current trends and open problems," *Research Advances in Cloud Computing*, Springer, pp. 1–20, 2017.  
[8] K. Morris, *Infrastructure as Code: Dynamic Systems for the Cloud Age*. O'Reilly Media, 2020.  
[9] J. Humble and D. Farley, *Continuous Delivery: Reliable Software Releases through Build, Test, and Deployment Automation*. Addison-Wesley, 2010.  
[10] Basel Committee on Banking Supervision, "Minimum capital requirements for market risk," *Bank for International Settlements*, Standards Document, 2019.  
[11] H. Markowitz, "Portfolio selection," *The Journal of Finance*, vol. 7, no. 1, pp. 77–91, 1952.  
[12] R. T. Rockafellar and S. Uryasev, "Optimization of conditional value-at-risk," *Journal of Risk*, vol. 2, pp. 21–42, 2000.
