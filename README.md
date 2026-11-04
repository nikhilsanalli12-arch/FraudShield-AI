# FraudShield AI

> **Tagline:** *Your transactions. Your security. Your control.*

FraudShield AI is a unified, institutional-grade AI-powered financial safety and intelligence platform. It empowers personal users to protect their financial footprint and equips authorized financial analysts with real-time transaction monitoring, fraud alert triage, and entity relationship graphs.

---

## Unified Capabilities

1. **Transaction Security**: Automated CSV ingestion, duplicate detection, velocity spike alerts, supervised fraud scoring, and SHAP explainability.
2. **Website & Link Scanner**: SSRF-safe URL inspection, domain age heuristics, homograph/lookalike analysis, and known reputation checks.
3. **Financial App Analyzer**: Permission audit, developer registry cross-checks, and official store verification (strictly no remote APK execution).
4. **Loan Analyzer**: Deterministic reducing-balance EMI calculations, hidden charge detection, and APR breakdown.
5. **Investment Offer Analyzer**: Guaranteed-return claim detection, regulatory registration verification (RBI/SEBI), and transparency scoring.
6. **Financial Trust Reports**: Cryptographically indexed, evidence-backed safety assessments with clear limitations.
7. **Analyst Command Center**: Multi-account transaction radar, React Flow entity relationship graphs, and synthetic transaction simulator.

---

## System Architecture

```text
React + Vite Frontend (Tailwind CSS, Lucide, Recharts, React Flow)
        │
        ▼
Node.js + Express API Gateway (Zod validation, RBAC, SSRF defense)
        │
        ▼
Python FastAPI Microservice (Scikit-Learn, Isolation Forest, NetworkX, SHAP)
        │
        ▼
Supabase PostgreSQL (Row Level Security, Auth, Storage)
```

---

## Local Development Setup

### Prerequisites
- **Node.js**: v20+ (v24.15.0 verified)
- **npm**: v10+ (v11.12.1 verified)
- **Python**: v3.11+ (v3.15.0 / v3.14.4 verified)
- **Git**: Isolated local repository initialized

### Quickstart

1. **Clone & Configure Environment**:
   ```bash
   cp .env.example .env
   ```

2. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Backend Setup** *(Milestone 2+)*:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

4. **AI Service Setup** *(Milestone 6+)*:
   ```bash
   cd ai-service
   python -m venv .venv
   source .venv/bin/activate  # Or on Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   python run.py
   ```

---

## Security & Ethics Policy

- **No Real Bank Credentials**: We never collect or process banking passwords, UPI PINs, OTPs, ATM PINs, or CVVs.
- **SSRF Prevention**: Strict DNS IP resolution, loopback blocking, cloud metadata IP blacklisting, and redirect pinning.
- **Synthetic Data**: All development, demo accounts, and simulator sessions use strictly anonymized and synthetic data.
- **Explainable Indicators**: AI models provide statistical risk indicators and anomaly scores; they are never described as definitive proof of criminality.

---

## Project Status

For real-time development tracking, milestone completions, test evidence, and known considerations, refer to [`PROJECT_STATUS.md`](./PROJECT_STATUS.md).

