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
Node.js + Express API Gateway (Zod validation, Supabase JWT auth, RBAC, Helmet, CORS)
        │
        ▼
Python FastAPI Microservice (Scikit-Learn, Isolation Forest, NetworkX, SHAP)
        │
        ▼
Supabase PostgreSQL (Row Level Security, Auth, Anti-Tampering Triggers)
```

---

## Role-Based Access Control & Dashboard Architecture

- **Public Registrations**: Always receive the `personal` role by default. Client metadata roles are explicitly ignored by database triggers.
- **Role Promotion**: Analyst and Admin roles are granted strictly through trusted administrative operations or direct SQL updates (`supabase/seed.sql`).
- **Row Level Security**: Users can only query and modify their own non-role profile fields (`auth.uid() = id`).
- **Backend Validation**: The Express backend verifies tokens directly via Supabase Auth (`supabase.auth.getUser()`) and queries the verified role from `public.profiles` using the service role key.
- **Role-Guarded Dashboards**:
  - `/dashboard` — **Personal User Portal**: Verifiable account security attributes, financial safety shortcuts (coming soon), and sample transaction previews.
  - `/analyst/dashboard` — **Financial Analyst Portal**: Triage queue, read-only telemetry inspection, in-memory demo notes, and risk band velocity charts (`RoleGate: ['analyst', 'admin']`).
  - `/admin/dashboard` — **Platform Administration**: Real backend gateway telemetry, PostgreSQL connection health, and server-side profile distribution counts (`RoleGate: ['admin']`).
- **Privileged Backend API**: `/api/v1/admin/stats` protected by `authMiddleware` and `requireRole(['admin'])`.

---

## Local Development Setup

### Prerequisites
- **Node.js**: v20+ (v24.15.0 verified)
- **npm**: v10+ (npm 11.12.1 verified)
- **Python**: v3.11+ (Python 3.15.0 / 3.14.4 verified)
- **Supabase**: Cloud project or local Supabase CLI

### 1. Database Setup
Execute the migration located in [`supabase/migrations/001_auth_and_profiles.sql`](./supabase/migrations/001_auth_and_profiles.sql) in your Supabase SQL Editor.

### 2. Frontend Setup
```bash
cd frontend
npm install
# Create frontend/.env with:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-supabase-public-anon-key
# VITE_API_URL=http://localhost:5000/api/v1
npm run dev
```

### 3. Backend Setup
```bash
cd backend
npm install
# Create backend/.env with:
# PORT=5000
# FRONTEND_URL=http://localhost:5173
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
npm run dev
# Run automated security & role tests:
npm test
```

### 4. AI Service Setup *(Milestone 6+)*
```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
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
