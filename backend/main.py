from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import joblib
import numpy as np
import uuid
import logging
import time
import traceback
from feature_extractor import extract_features

app = FastAPI(title="UIDAI Passive Bot Detector API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

verified_tokens = {}
verification_logs = []
blocked_sessions = {}
failed_attempts = {}
known_bot_fingerprints = set()
stats = {"total": 0, "humans": 0, "bots": 0, "challenges": 0, "permanent_blocks": 0}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

HUMAN_THRESHOLD = 0.75
BOT_THRESHOLD = 0.45

class SignalPayload(BaseModel):
    sessionId: str
    mouseSignals: List[Dict[str, Any]] = []
    keystrokeSignals: List[Dict[str, Any]] = []
    scrollSignals: List[Dict[str, Any]] = []
    clickSignals: List[Dict[str, Any]] = []
    browserEnv: Dict[str, Any] = {}
    timingSignals: Dict[str, Any] = {}
    behaviorSignals: Dict[str, Any] = {}
    interactionSummary: Dict[str, Any] = {}

class VerificationResult(BaseModel):
    isHuman: bool
    confidence: float
    action: str
    token: Optional[str] = None
    challengeType: Optional[str] = None

try:
    model = joblib.load('bot_detector_model.pkl')
    logger.info("ML Model loaded successfully!")
except:
    model = None
    logger.warning("No ML model found yet. Train the model first!")

@app.get("/")
def home():
    return {"message": "UIDAI Bot Detector API is running!"}

@app.post("/api/verify-human", response_model=VerificationResult)
async def verify_human(payload: SignalPayload, request: Request):

    # Check permanent block
    if payload.sessionId in blocked_sessions:
        return VerificationResult(isHuman=False, confidence=0.0, action='block')

    # Check failed attempts
    session_attempts = failed_attempts.get(payload.sessionId, 0)
    if session_attempts >= 3:
        blocked_sessions[payload.sessionId] = True
        stats["permanent_blocks"] += 1
        return VerificationResult(isHuman=False, confidence=0.0, action='block')

    mouse_count = len(payload.mouseSignals)
    key_count = len(payload.keystrokeSignals)

    try:
        if model is None:
            return VerificationResult(isHuman=True, confidence=0.5, action='allow', token=str(uuid.uuid4()))

        features = extract_features(payload.dict()).reshape(1, -1)
        prob_human = float(model.predict_proba(features)[0][1])

        # Device fingerprint check
        fingerprint = payload.dict().get('browserEnv', {}).get('deviceFingerprint', None)
        if fingerprint and fingerprint in known_bot_fingerprints:
            prob_human = min(prob_human, 0.4)

        # Copy paste check
        copy_paste = payload.dict().get('behaviorSignals', {}).get('copyPasteCount', 0)
        paste_events = payload.dict().get('behaviorSignals', {}).get('pasteEvents', [])
        logger.info(f"Copy paste count: {copy_paste} | Paste events: {paste_events}")

        if copy_paste >= 3:
            prob_human = min(prob_human, 0.4)
        elif copy_paste >= 2:
            prob_human = min(prob_human, 0.55)
        if paste_events and len(paste_events) > 0 and max(paste_events) > 5:
            prob_human = min(prob_human, 0.5)

        # Signal based adjustments
        if mouse_count == 0 and key_count == 0:
            prob_human = 0.1
        elif mouse_count == 0:
            prob_human = min(prob_human, 0.35)
        elif key_count == 0 and mouse_count >= 10:
            prob_human = 0.55
        elif key_count == 0 and mouse_count < 10:
            prob_human = min(prob_human, 0.35)
        elif mouse_count >= 10 and key_count >= 3:
            pass

        logger.info(f"Session {payload.sessionId[:8]}... | P(human)={prob_human:.3f} | mouse={mouse_count} keys={key_count}")

        # Decision
        if prob_human >= HUMAN_THRESHOLD:
            action = 'allow'
        elif prob_human <= BOT_THRESHOLD:
            action = 'block'
        else:
            action = 'challenge'

        # Log it
        log_entry = {
            "id": len(verification_logs) + 1,
            "time": time.strftime("%H:%M:%S"),
            "sessionId": payload.sessionId[:8] + "...",
            "confidence": round(prob_human * 100, 1),
            "mouseSignals": mouse_count,
            "keystrokes": key_count,
            "action": action,
            "isHuman": action == 'allow'
        }
        stats["total"] += 1
        if action == 'allow':
            stats["humans"] += 1
            failed_attempts.pop(payload.sessionId, None)
        elif action == 'block':
            stats["bots"] += 1
            failed_attempts[payload.sessionId] = failed_attempts.get(payload.sessionId, 0) + 1
            if fingerprint and prob_human < 0.2:
                known_bot_fingerprints.add(fingerprint)
        else:
            stats["challenges"] += 1
            failed_attempts[payload.sessionId] = failed_attempts.get(payload.sessionId, 0) + 1

        verification_logs.append(log_entry)
        if len(verification_logs) > 50:
            verification_logs.pop(0)

        if action == 'allow':
            token = str(uuid.uuid4())
            verified_tokens[token] = prob_human
            return VerificationResult(isHuman=True, confidence=prob_human, action='allow', token=token)
        elif action == 'block':
            return VerificationResult(isHuman=False, confidence=prob_human, action='block')
        else:
            return VerificationResult(isHuman=False, confidence=prob_human, action='challenge', challengeType='simple_click')

    except Exception as e:
        logger.error(f"Error: {e}")
        logger.error(traceback.format_exc())
        if mouse_count == 0 and key_count == 0:
            return VerificationResult(isHuman=False, confidence=0.2, action='block')
        return VerificationResult(isHuman=True, confidence=0.8, action='allow')

@app.post("/api/validate-token")
async def validate_token(token: str):
    if token not in verified_tokens:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    del verified_tokens[token]
    return {"valid": True}

@app.get("/api/dashboard")
async def get_dashboard():
    return {"stats": stats, "logs": list(reversed(verification_logs))}

@app.get("/api/dashboard/reset")
async def reset_dashboard():
    verification_logs.clear()
    stats["total"] = 0
    stats["humans"] = 0
    stats["bots"] = 0
    stats["challenges"] = 0
    stats["permanent_blocks"] = 0
    return {"message": "Dashboard reset!"}

@app.post("/api/risk-score")
async def get_risk_score(request: Request):
    body = await request.json()
    session_id = body.get('sessionId', '')
    risk = 20
    attempts = failed_attempts.get(session_id, 0)
    risk += attempts * 20
    if session_id in blocked_sessions:
        risk = 100
    risk = max(0, min(100, risk))
    return {"riskScore": risk}