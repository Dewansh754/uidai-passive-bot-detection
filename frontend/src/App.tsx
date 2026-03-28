import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './Dashboard';
import { useSignalCollector } from './useSignalCollector';
import './App.css';

type AppState = 'collecting' | 'verifying' | 'verified' | 'challenge' | 'blocked';

function App() {
  const [riskScore, setRiskScore] = useState(0);
  const [honeypot, setHoneypot] = useState('');
  const [honeypot2, setHoneypot2] = useState('');
  const [appState, setAppState] = useState<AppState>('collecting');
  const [confidence, setConfidence] = useState<number>(0);
  const [aadhaarNo, setAadhaarNo] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [challengeDone, setChallengeDone] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(() => {
    return parseInt(sessionStorage.getItem('failed_attempts') || '0');
  });
  const [permanentBlock, setPermanentBlock] = useState(() => {
    return sessionStorage.getItem('permanent_block') === 'true';
  });
  // Restore block state on refresh
  useEffect(() => {
    if (permanentBlock) setAppState('blocked');
  }, [permanentBlock]);
  // Live risk score updater
  useEffect(() => {
    if (appState !== 'collecting') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/risk-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionStorage.getItem('uidai_session_id') || '',
            mouseCount: 0,
            keyCount: 0,
          })
        });
        const data = await res.json();
        setRiskScore(data.riskScore);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [appState]);
  const { submitSignals, resetSignals } = useSignalCollector();

  const handleSubmit = async () => {
    // Instant bot detection — honeypot fields filled
    if (honeypot !== '' || honeypot2 !== '') {
      setConfidence(0.0);
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      sessionStorage.setItem('failed_attempts', String(newAttempts));
      if (newAttempts >= 3) {
        setPermanentBlock(true);
        sessionStorage.setItem('permanent_block', 'true');
      }
      setAppState('blocked');
      return;
    }
    setAppState('verifying');
    try {
      const result = await submitSignals();
      setConfidence(result.confidence);

      if (result.action === 'allow') {
        setAppState('verified');
        setFailedAttempts(0);
        sessionStorage.setItem('failed_attempts', '0');
      } else if (result.action === 'challenge') {
        setChallengeDone(false);
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        sessionStorage.setItem('failed_attempts', String(newAttempts));
        setAppState('challenge');
      } else {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        sessionStorage.setItem('failed_attempts', String(newAttempts));
        if (newAttempts >= 3 || result.confidence === 0) {
          setPermanentBlock(true);
          sessionStorage.setItem('permanent_block', 'true');
        }
        setAppState('blocked');
      }
    } catch (err) {
      setAppState('verified');
    }
  };

  const handleChallengeComplete = () => {
    setChallengeDone(true);
    setTimeout(() => setAppState('verified'), 1000);
  };

  return (
    <div style={styles.container}>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logo}>🔷</div>
          <div>
            <h1 style={styles.headerTitle}>UIDAI Aadhaar Portal</h1>
            <p style={styles.headerSub}>Unique Identification Authority of India</p>
          </div>
        </div>
        <div style={styles.securityBadge}>🔒 Passive Bot Protection Active</div>
      </div>

      {/* Main Card */}
      <div style={styles.card}>

        {/* FORM STATE */}
        {appState === 'collecting' && (
          <div>
            <h2 style={styles.cardTitle}>Aadhaar Verification</h2>
            <p style={styles.cardSubtitle}>Please fill in your details below</p>

            {/* HONEYPOT - hidden from humans, bots will fill this */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0, pointerEvents: 'none' }} aria-hidden="true">
              <input
                type="text"
                name="username"
                id="hp1"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={e => setHoneypot(e.target.value)}
                placeholder="Leave this empty"
              />
              <input
                type="email"
                name="email_address"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot2}
                onChange={e => setHoneypot2(e.target.value)}
                placeholder="Leave this empty"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Aadhaar Number</label>
              <input
                style={styles.input}
                type="text"
                placeholder="XXXX XXXX XXXX"
                maxLength={14}
                value={aadhaarNo}
                onChange={e => setAadhaarNo(e.target.value)}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Full Name</label>
              <input
                style={styles.input}
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Date of Birth</label>
              <input
                style={styles.input}
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
              />
            </div>

            <div style={styles.passiveNote}>
              🛡️ This portal uses passive bot detection — no CAPTCHA needed!
            </div>

            {/* Live Risk Score Meter */}
            <div style={riskStyles.container}>
              <div style={riskStyles.header}>
                <span style={riskStyles.title}>🔍 Live Risk Analysis</span>
                <span style={{
                  ...riskStyles.badge,
                  background: riskScore < 30 ? '#dcfce7' : riskScore < 60 ? '#fef9c3' : '#fee2e2',
                  color: riskScore < 30 ? '#16a34a' : riskScore < 60 ? '#92400e' : '#dc2626',
                }}>
                  {riskScore < 30 ? '✅ Low Risk' : riskScore < 60 ? '⚠️ Medium Risk' : '🚨 High Risk'}
                </span>
              </div>
              <div style={riskStyles.meterBg}>
                <div style={{
                  ...riskStyles.meterFill,
                  width: `${riskScore}%`,
                  background: riskScore < 30
                    ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                    : riskScore < 60
                    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                    : 'linear-gradient(90deg, #dc2626, #ef4444)',
                }}></div>
              </div>
              <div style={riskStyles.labels}>
                <span>Safe</span>
                <span>Risk Score: {riskScore}%</span>
                <span>Dangerous</span>
              </div>
              <div style={riskStyles.signals}>
                <span style={riskStyles.signal}>🖱️ Mouse tracking active</span>
                <span style={riskStyles.signal}>⌨️ Keystroke analysis active</span>
                <span style={riskStyles.signal}>🌐 Environment checked</span>
              </div>
            </div>

            <button style={styles.button} onClick={handleSubmit}>
              Verify Identity
            </button>
          </div>
        )}

        {/* VERIFYING STATE */}
        {appState === 'verifying' && (
          <div style={styles.centerBox}>
            <div style={styles.spinner}></div>
            <h2 style={styles.cardTitle}>Analyzing Session...</h2>
            <p style={styles.cardSubtitle}>Our ML model is checking your behavior patterns</p>
            <div style={styles.signalList}>
              <div style={styles.signalItem}>🖱️ Analyzing mouse movements...</div>
              <div style={styles.signalItem}>⌨️ Analyzing typing patterns...</div>
              <div style={styles.signalItem}>🌐 Checking browser environment...</div>
            </div>
          </div>
        )}

         {/* CHALLENGE STATE */}
        {appState === 'challenge' && (
          <ImageChallenge onPass={handleChallengeComplete} />
        )}

        {/* VERIFIED STATE */}
        {appState === 'verified' && (
          <div style={styles.centerBox}>
            <div style={styles.successIcon}>✅</div>
            <h2 style={{ ...styles.cardTitle, color: '#16a34a' }}>Identity Verified!</h2>
            <p style={styles.cardSubtitle}>You have been successfully verified as a human</p>
            <div style={styles.resultBox}>
              <div style={styles.resultRow}>
                <span>Human Confidence Score</span>
                <span style={styles.scoreGreen}>{(confidence * 100).toFixed(1)}%</span>
              </div>
              <div style={styles.resultRow}>
                <span>Detection Method</span>
                <span style={styles.badge}>Passive ML</span>
              </div>
              <div style={styles.resultRow}>
                <span>CAPTCHA Shown</span>
                <span style={styles.badgeGreen}>None ✓</span>
              </div>
            </div>
            <button style={styles.button} onClick={() => {
              setAppState('collecting');
              setAadhaarNo(''); setName(''); setDob('');
              resetSignals();
            }}>
              Start New Verification
            </button>
          </div>
        )}

        {/* BLOCKED STATE */}
        {appState === 'blocked' && (
          <BlockScreen
            confidence={confidence}
            failedAttempts={failedAttempts}
            permanentBlock={permanentBlock}
            onRetry={() => {
              if (!permanentBlock) {
                setAppState('collecting');
              }
            }}
          />
        )}

      </div>

      {/* Footer */}
      <div style={styles.footer}>
        🔐 Protected by UIDAI Passive Bot Detection System | No CAPTCHA | Privacy First
      </div>

    </div>
  );
}

const CHALLENGES = [
  {
    question: '🌳 Click the image that shows a TREE',
    images: [
      { emoji: '🌲', label: 'Tree', correct: true },
      { emoji: '🚗', label: 'Car', correct: false },
      { emoji: '🏠', label: 'House', correct: false },
    ]
  },
  {
    question: '🐶 Click the image that shows a DOG',
    images: [
      { emoji: '🐱', label: 'Cat', correct: false },
      { emoji: '🐶', label: 'Dog', correct: true },
      { emoji: '🐟', label: 'Fish', correct: false },
    ]
  },
  {
    question: '☀️ Click the image that shows the SUN',
    images: [
      { emoji: '🌙', label: 'Moon', correct: false },
      { emoji: '⭐', label: 'Star', correct: false },
      { emoji: '☀️', label: 'Sun', correct: true },
    ]
  },
  {
    question: '🍎 Click the image that shows an APPLE',
    images: [
      { emoji: '🍎', label: 'Apple', correct: true },
      { emoji: '🍌', label: 'Banana', correct: false },
      { emoji: '🍇', label: 'Grapes', correct: false },
    ]
  },
];

function ImageChallenge({ onPass }: { onPass: () => void }) {
  const [challenge] = useState(() =>
    CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [attempts, setAttempts] = useState(0);

  const handleSelect = (index: number, correct: boolean) => {
    if (result === 'correct') return;
    setSelected(index);
    if (correct) {
      setResult('correct');
      setTimeout(onPass, 1000);
    } else {
      setResult('wrong');
      setAttempts(a => a + 1);
      setTimeout(() => {
        setSelected(null);
        setResult(null);
      }, 800);
    }
  };

  return (
    <div style={styles.centerBox}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤔</div>
      <h2 style={styles.cardTitle}>Quick Verification</h2>
      <p style={styles.cardSubtitle}>Solve this simple challenge to continue</p>

      <div style={challengeStyles.box}>
        <p style={challengeStyles.question}>{challenge.question}</p>

        <div style={challengeStyles.imageGrid}>
          {challenge.images.map((img, i) => {
            const isSelected = selected === i;
            const isCorrect = isSelected && result === 'correct';
            const isWrong = isSelected && result === 'wrong';

            return (
              <button
                key={i}
                style={{
                  ...challengeStyles.imageBtn,
                  background: isCorrect ? '#dcfce7' : isWrong ? '#fee2e2' : '#f9fafb',
                  border: isCorrect ? '2px solid #16a34a' : isWrong ? '2px solid #dc2626' : '2px solid #e5e7eb',
                  transform: isSelected ? 'scale(0.96)' : 'scale(1)',
                }}
                onClick={() => handleSelect(i, img.correct)}
              >
                <span style={challengeStyles.imageEmoji}>{img.emoji}</span>
                <span style={challengeStyles.imageLabel}>{img.label}</span>
                {isCorrect && <span style={challengeStyles.tick}>✅</span>}
                {isWrong && <span style={challengeStyles.tick}>❌</span>}
              </button>
            );
          })}
        </div>

        {result === 'correct' && (
          <div style={challengeStyles.successMsg}>✅ Correct! Verifying you now...</div>
        )}
        {result === 'wrong' && (
          <div style={challengeStyles.wrongMsg}>❌ Wrong! Try again...</div>
        )}
        {attempts > 0 && result !== 'correct' && (
          <div style={challengeStyles.attempts}>Attempts: {attempts}</div>
        )}
      </div>
    </div>
  );
}

function BlockScreen({ confidence, failedAttempts, permanentBlock, onRetry }: {
  confidence: number,
  failedAttempts: number,
  permanentBlock: boolean,
  onRetry: () => void
}) {
  const [countdown, setCountdown] = useState(permanentBlock ? 0 : 30);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  return (
    <div style={blockStyles.container}>

      {/* Red warning header */}
      <div style={blockStyles.warningHeader}>
        <div style={blockStyles.warningIcon}>⛔</div>
        <h2 style={blockStyles.warningTitle}>ACCESS DENIED</h2>
        <p style={blockStyles.warningSubtitle}>Automated Bot Activity Detected</p>
      </div>

      {/* Details */}
      <div style={blockStyles.detailsBox}>
        <div style={blockStyles.detailRow}>
          <span style={blockStyles.detailLabel}>🤖 Bot Probability</span>
          <span style={blockStyles.detailValueRed}>{((1 - confidence) * 100).toFixed(1)}%</span>
        </div>
        <div style={blockStyles.detailRow}>
          <span style={blockStyles.detailLabel}>🛡️ Protection System</span>
          <span style={blockStyles.detailValue}>Passive ML Detection</span>
        </div>
        <div style={blockStyles.detailRow}>
          <span style={blockStyles.detailLabel}>📋 Incident Logged</span>
          <span style={blockStyles.detailValue}>Yes</span>
        </div>
        <div style={blockStyles.detailRow}>
          <span style={blockStyles.detailLabel}>⏰ Block Time</span>
          <span style={blockStyles.detailValue}>{new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Warning message */}
      <div style={blockStyles.warningMsg}>
        ⚠️ This incident has been recorded. Repeated attempts may result in a permanent IP ban.
      </div>

      {/* Attempts indicator */}
      {!permanentBlock && (
        <div style={blockStyles.attemptsBox}>
          {[1,2,3].map(i => (
            <span key={i} style={{
              ...blockStyles.attemptDot,
              background: i <= failedAttempts ? '#dc2626' : '#e5e7eb'
            }}>●</span>
          ))}
          <span style={blockStyles.attemptsText}>
            {3 - failedAttempts} attempt{3 - failedAttempts !== 1 ? 's' : ''} remaining
          </span>
        </div>
      )}

      {/* Countdown retry */}
      <div style={blockStyles.countdownBox}>
        {permanentBlock ? (
          <div style={blockStyles.permanentBox}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔒</div>
            <p style={blockStyles.permanentText}>Session Permanently Blocked</p>
            <p style={blockStyles.permanentSub}>Please close and reopen your browser to try again</p>
          </div>
        ) : countdown > 0 ? (
          <>
            <p style={blockStyles.countdownText}>You may retry in</p>
            <div style={blockStyles.countdownNumber}>{countdown}</div>
            <p style={blockStyles.countdownText}>seconds</p>
          </>
        ) : (
          <button style={blockStyles.retryBtn} onClick={onRetry}>
            🔄 Try Again
          </button>
        )}
      </div>

      {/* Help text */}
      <p style={blockStyles.helpText}>
        If you believe this is a mistake, please contact{' '}
        <span style={blockStyles.helpLink}>support@uidai.gov.in</span>
      </p>
    </div>
  );
}

const riskStyles: Record<string, React.CSSProperties> = {
  container: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '20px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  title: { fontSize: '13px', fontWeight: 600, color: '#374151' },
  badge: { padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 },
  meterBg: { height: '12px', background: '#e5e7eb', borderRadius: '6px', overflow: 'hidden', marginBottom: '6px' },
  meterFill: { height: '100%', borderRadius: '6px', transition: 'width 0.8s ease, background 0.8s ease' },
  labels: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af', marginBottom: '10px' },
  signals: { display: 'flex', gap: '12px', flexWrap: 'wrap' as const },
  signal: { fontSize: '11px', color: '#6b7280', background: '#f1f5f9', padding: '3px 8px', borderRadius: '8px' },
};

const blockStyles: Record<string, React.CSSProperties> = {
  container: { textAlign: 'center' as const },
  warningHeader: { background: 'linear-gradient(135deg, #dc2626, #991b1b)', borderRadius: '12px', padding: '24px', marginBottom: '20px', color: 'white' },
  warningIcon: { fontSize: '52px', marginBottom: '8px' },
  warningTitle: { margin: '0 0 6px', fontSize: '24px', fontWeight: 800, letterSpacing: '2px' },
  warningSubtitle: { margin: 0, fontSize: '14px', opacity: 0.9 },
  detailsBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '16px', marginBottom: '16px' },
  detailRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #fee2e2', fontSize: '13px' },
  detailLabel: { color: '#6b7280', fontWeight: 500 },
  detailValue: { color: '#374151', fontWeight: 600 },
  detailValueRed: { color: '#dc2626', fontWeight: 700 },
  warningMsg: { background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#92400e', marginBottom: '16px' },
  countdownBox: { padding: '16px', marginBottom: '12px' },
  countdownText: { margin: '4px 0', fontSize: '13px', color: '#6b7280' },
  countdownNumber: { fontSize: '48px', fontWeight: 800, color: '#dc2626', lineHeight: 1 },
  retryBtn: { padding: '12px 32px', background: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },
  helpText: { fontSize: '12px', color: '#9ca3af' },
  helpLink: { color: '#1e3a5f', fontWeight: 600 },
  attemptsBox: { display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '12px' },
  attemptDot: { fontSize: '20px', transition: 'color 0.3s' },
  attemptsText: { fontSize: '13px', color: '#6b7280', marginLeft: '4px' },
  permanentBox: { background: '#1e1e1e', borderRadius: '10px', padding: '20px', color: 'white' },
  permanentText: { fontSize: '16px', fontWeight: 700, color: '#ff4444', margin: '0 0 8px' },
  permanentSub: { fontSize: '13px', color: '#9ca3af', margin: 0 },
};
const challengeStyles: Record<string, React.CSSProperties> = {
  box: { background: '#fefce8', border: '1px solid #fde68a', borderRadius: '12px', padding: '24px', margin: '16px 0' },
  question: { fontSize: '16px', fontWeight: 600, color: '#92400e', marginBottom: '20px', textAlign: 'center' as const },
  imageGrid: { display: 'flex', gap: '12px', justifyContent: 'center' },
  imageBtn: { flex: 1, padding: '16px 8px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s ease', position: 'relative' as const, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '8px' },
  imageEmoji: { fontSize: '40px' },
  imageLabel: { fontSize: '13px', fontWeight: 600, color: '#374151' },
  tick: { position: 'absolute' as const, top: '6px', right: '6px', fontSize: '16px' },
  successMsg: { marginTop: '16px', padding: '10px', background: '#dcfce7', borderRadius: '8px', color: '#16a34a', fontWeight: 600, fontSize: '14px', textAlign: 'center' as const },
  wrongMsg: { marginTop: '16px', padding: '10px', background: '#fee2e2', borderRadius: '8px', color: '#dc2626', fontWeight: 600, fontSize: '14px', textAlign: 'center' as const },
  attempts: { marginTop: '8px', fontSize: '12px', color: '#9ca3af', textAlign: 'center' as const },
};
const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', background: '#f0f4f8', fontFamily: 'Segoe UI, sans-serif' },
  header: { background: '#1e3a5f', color: 'white', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerInner: { display: 'flex', alignItems: 'center', gap: '12px' },
  logo: { fontSize: '36px' },
  headerTitle: { margin: 0, fontSize: '22px', fontWeight: 700 },
  headerSub: { margin: 0, fontSize: '13px', opacity: 0.8 },
  securityBadge: { background: '#16a34a', padding: '6px 14px', borderRadius: '20px', fontSize: '13px' },
  card: { maxWidth: '480px', margin: '40px auto', background: 'white', borderRadius: '16px', padding: '36px', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' },
  cardTitle: { fontSize: '22px', fontWeight: 700, color: '#1e3a5f', marginBottom: '8px' },
  cardSubtitle: { color: '#6b7280', marginBottom: '24px', fontSize: '14px' },
  formGroup: { marginBottom: '20px' },
  label: { display: 'block', fontWeight: 600, marginBottom: '6px', color: '#374151', fontSize: '14px' },
  input: { width: '100%', padding: '10px 14px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box' as const, outline: 'none' },
  passiveNote: { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#1d4ed8', marginBottom: '20px' },
  button: { width: '100%', padding: '12px', background: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' },
  buttonSuccess: { width: '100%', padding: '12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 600, cursor: 'default' },
  centerBox: { textAlign: 'center' as const },
  spinner: { width: '48px', height: '48px', border: '4px solid #e5e7eb', borderTop: '4px solid #1e3a5f', borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 1s linear infinite' },
  signalList: { background: '#f9fafb', borderRadius: '8px', padding: '16px', marginTop: '16px', textAlign: 'left' as const },
  signalItem: { padding: '6px 0', fontSize: '14px', color: '#374151' },
  challengeIcon: { fontSize: '48px', marginBottom: '16px' },
  challengeBox: { background: '#fefce8', border: '1px solid #fde68a', borderRadius: '8px', padding: '20px', margin: '20px 0' },
  challengeText: { fontSize: '15px', color: '#92400e', marginBottom: '16px' },
  challengeButton: { padding: '12px 32px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' },
  successIcon: { fontSize: '64px', marginBottom: '16px' },
  blockedIcon: { fontSize: '64px', marginBottom: '16px' },
  resultBox: { background: '#f9fafb', borderRadius: '8px', padding: '16px', margin: '20px 0', textAlign: 'left' as const },
  resultRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb', fontSize: '14px' },
  scoreGreen: { color: '#16a34a', fontWeight: 700 },
  scoreRed: { color: '#dc2626', fontWeight: 700 },
  badge: { background: '#1e3a5f', color: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '12px' },
  badgeGreen: { background: '#16a34a', color: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '12px' },
  badgeRed: { background: '#dc2626', color: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '12px' },
  footer: { textAlign: 'center' as const, padding: '20px', color: '#6b7280', fontSize: '13px' },
};

function AppWrapper() {
  return (
    <Router>
      <div style={{ background: '#1e3a5f', padding: '8px 32px', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <Link to="/" style={{ color: 'white', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
          🏠 Portal
        </Link>
        <Link to="/dashboard" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
          📊 Admin Dashboard
        </Link>
        <button
          onClick={() => {
            sessionStorage.clear();
            window.location.href = '/';
          }}
          style={{ marginLeft: 'auto', padding: '4px 12px', background: '#374151', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
        >
          🔄 Reset Session
        </button>
      </div>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}
export default AppWrapper;