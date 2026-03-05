# 🔐 UIDAI Passive Bot Detection System

A machine learning powered passive CAPTCHA replacement system for UIDAI Aadhaar portal that detects bots without interrupting real users.

## 🎯 Problem Statement
UIDAI portals use traditional CAPTCHA which creates friction for genuine users. This system replaces active CAPTCHA with a passive ML-based solution that silently analyzes user behavior to distinguish humans from bots.

## 🏗️ Architecture
```
Browser (Frontend) → Signal Collector → Backend API → ML Model → Decision Engine
                                                                      ↓
                                               Allow / Challenge / Block / Permanent Block
```

## ✨ Features
- 🛡️ **Passive Bot Detection** — No CAPTCHA shown to users
- 🤖 **ML Model** — 100% AUC score trained on 20,000 samples
- 📡 **8 Signal Types** — Mouse, keyboard, scroll, click, timing, behavior, environment, fingerprint
- 🍯 **Honeypot Fields** — Invisible fields that trap bots instantly
- ⌨️ **Typing Analysis** — Detects copy-paste vs natural typing
- 🔏 **Device Fingerprinting** — Identifies returning bots after browser restart
- 📊 **Risk Score Meter** — Live gauge showing suspicion level
- 🖼️ **Image Challenge** — Minimal challenge for suspicious behavior
- 🔒 **Permanent Session Block** — After 3 failed attempts
- 📈 **Admin Dashboard** — Real-time monitoring with alerts

## 🧪 Test Results
| Test | Scenario | Result |
|---|---|---|
| 1 | Normal human behavior | ✅ 100% Verified |
| 2 | No mouse, no typing | 🚫 90% Bot Blocked |
| 3 | Mouse only, no typing | 🤔 Challenge issued |
| 4 | Copy paste detection | 🚫 100% Bot Blocked |
| 5 | Honeypot fields | 🚫 Instant Block |
| 6 | 3 failed attempts | 🔒 Permanently Blocked |
| 7 | Image challenge | 🖼️ Working |
| 8 | Dashboard accuracy | 📊 All stats correct |
| 9 | Risk score meter | 📈 Increases after failures |
| 10 | Full human journey | ✅ 100% Verified |

## 🛠️ Tech Stack
- **Frontend:** React + TypeScript
- **Backend:** FastAPI (Python)
- **ML Model:** Gradient Boosting Classifier (Scikit-learn)
- **Signal Collection:** Custom React hooks

## 📁 Project Structure
```
uidai-project/
├── frontend/          ← React + TypeScript app
│   └── src/
│       ├── App.tsx
│       ├── Dashboard.tsx
│       └── useSignalCollector.ts
├── backend/           ← FastAPI Python server
│   ├── main.py
│   └── feature_extractor.py
└── ml-model/          ← ML training scripts
    └── train_model.py
```

## 🚀 How to Run

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install fastapi uvicorn scikit-learn numpy pandas joblib
uvicorn main:app --reload
```

### Train ML Model
```bash
cd ml-model
python train_model.py
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## 🔒 Privacy Compliance
- ✅ No PII collected
- ✅ Keys anonymized to type only
- ✅ Session-scoped data only
- ✅ IP addresses hashed in logs
- ✅ Tokens single-use only
- ✅ HTTPS enforced in production

## 👨‍💻 Built for UIDAI Hackathon Challenge
This solution meets all UIDAI requirements:
- Passive parameter analysis via browser context
- ML model deployed in backend
- Pluggable architecture for API protection
- Privacy policy compliant
- Complete frontend + backend + ML model