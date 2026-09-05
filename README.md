# 🥛 Azhagi Farm

> **"Simple Milk Management. Accurate Monthly Billing."**

A production-ready, mobile-first milk customer management web application designed for milk sellers and farm owners. Replaces manual paper notebooks and messy spreadsheets with lightning-fast daily data entry, Morning/Evening batch separation, automatic litre and rupee calculations, and complete monthly payment tracking.

---

## 🌟 Key Features

1. **⚡ Fast Daily Milk Entry**
   - Separate **🌅 Morning** and **🌙 Evening** tabs — never mixed up.
   - One-tap quantity selection buttons: `¼ L`, `½ L`, `¾ L`, `1 L`, `1¼ L`, `1½ L`, `1¾ L`, `2 L` + Custom.
   - Dedicated **🚫 No Milk** button (distinguishes skipped milk from unentered data).
   - Multi-day No Milk range for customers traveling or on vacation.
   - Live completion progress bar and customer search.

2. **👥 Customer Management**
   - Morning/Evening delivery batch assignment.
   - Default daily milk quantity (pre-selected on daily entry).
   - Custom milk rate per customer or default farm rate.
   - Customer profile with complete monthly calendar history.

3. **💰 Automatic Monthly Billing & Payments**
   - Automatic monthly total litres calculation (skips No Milk days).
   - Rate-based billing formula: `Total Litres × Applicable Rate`.
   - **Historical Rate Preservation**: changing next month's rate does not tamper with previous bills!
   - **Bill Locking / Finalize Month**: freeze settled bills against accidental edits.
   - Multi-payment tracking: `🟢 PAID`, `🟡 PARTIAL`, `🔴 PENDING` with balance tracking.

4. **📱 Mobile-First & PWA Ready**
   - Touch-friendly large buttons for one-handed entry on Android/iOS browsers.
   - Bottom navigation on mobile devices; full sidebar navigation on desktop.
   - Installable PWA (`manifest.json`, high-res branding SVG).

---

## 🏗️ Architecture & Tech Stack

```
Azhagi Farm Milk/
├── frontend/                # React 19 + Vite + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/      # Responsive Layout, Nav, Modals
│   │   ├── pages/           # Dashboard, DailyEntry, Customers, Profile, Bills, Settings
│   │   ├── lib/             # API layer, Supabase client, LocalStore fallback, Seeder
│   │   └── types/           # Core TypeScript types & fraction formatting
│   └── public/              # Icons, manifest.json, SVG branding
│
├── backend/                 # FastAPI + Python 3.12
│   ├── app/
│   │   ├── api/             # Customers, Milk Entries, Bills, Payments, Settings, Dashboard
│   │   ├── core/            # Database layer, Supabase client, config
│   │   └── schemas/         # Pydantic schemas
│   └── test_scenario.py     # 20-step specification test suite
│
└── supabase/
    └── migrations/          # PostgreSQL schema with Row Level Security (RLS) & Indexes
```

---

## 🚀 Getting Started

### 1. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:5173`.

#### Running Without Cloud Credentials (Instant Demo Mode):
If `VITE_SUPABASE_URL` is not set, the app **automatically runs in Local Storage Demo Mode**! You can tap **"Quick Enter as Farm Owner"** on the login screen to immediately explore the app with zero setup friction.

#### Connecting Supabase PostgreSQL:
1. Create a project on [Supabase](https://supabase.com).
2. Go to the SQL Editor and execute `supabase/migrations/001_initial_schema.sql`.
3. In `frontend/.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Restart Vite (`npm run dev`).

---

### 2. Backend Setup (FastAPI)

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate       # Windows (or source venv/bin/activate on Mac/Linux)
pip install -r requirements.txt  # Or use existing venv
uvicorn app.main:app --reload --port 8000
```

FastAPI Swagger interactive docs will be available at: `http://localhost:8000/docs`.

---

## 🧪 Specification Verification (Section 53 Test Scenario)

To run the automated 20-step test scenario:

```bash
cd backend
.\venv\Scripts\python test_scenario.py
```

All 20 conditions are verified:
- Kumar added to Morning batch with 1.0L default and ₹60/L rate.
- Milk recorded: Sep 1 (1L), Sep 2 (1¼L), Sep 3 (¾L), Sep 4 (No Milk).
- Total verified = 3.0 L.
- September bill calculated = ₹180.0.
- Payment of ₹100 applied -> balance ₹80.0 (Status: PARTIAL).
- Additional payment of ₹80 applied -> balance ₹0.0 (Status: PAID).
- Bill locked/finalized and default rate changed to ₹65/L -> September bill remains ₹180.0.
- Mani added to Evening batch -> partitioned strictly to Evening batch.
- Morning and Evening totals separated on Dashboard.
- Unentered customers identified as "Not Entered" (not confused with "No Milk").
- Modifying entry dynamically updates monthly bill.
- Unique constraint enforced (no duplicate daily entries per customer).
