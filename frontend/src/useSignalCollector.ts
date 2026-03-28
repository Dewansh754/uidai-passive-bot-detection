import { useEffect, useRef, useCallback } from 'react';

interface MouseSignal {
  x: number;
  y: number;
  timestamp: number;
  velocity?: number;
}

interface KeystrokeSignal {
  key: string;
  dwellTime: number;
  flightTime: number;
  timestamp: number;
}

interface ScrollSignal {
  scrollY: number;
  timestamp: number;
  speed: number;
}

interface ClickSignal {
  x: number;
  y: number;
  timestamp: number;
  duration: number;
}

interface SignalData {
  sessionId: string;
  mouseSignals: MouseSignal[];
  keystrokeSignals: KeystrokeSignal[];
  scrollSignals: ScrollSignal[];
  clickSignals: ClickSignal[];
  browserEnv: object;
  timingSignals: object;
  behaviorSignals: object;
}

function generateSessionId(): string {
  const existing = sessionStorage.getItem('uidai_session_id');
  if (existing) return existing;
  // Fresh session - clear old paste data
  sessionStorage.removeItem('paste_count');
  const newId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem('uidai_session_id', newId);
  return newId;
}

function classifyKeyType(key: string): string {
  if (/^[a-zA-Z]$/.test(key)) return 'alpha';
  if (/^[0-9]$/.test(key)) return 'numeric';
  if (key === 'Backspace') return 'backspace';
  if (key === ' ') return 'space';
  return 'special';
}

function generateDeviceFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    window.screen.width + 'x' + window.screen.height,
    window.screen.colorDepth,
    navigator.hardwareConcurrency,
    (navigator as any).deviceMemory || 'unknown',
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.platform,
    // Canvas fingerprint
    (() => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('UIDAI🔐fingerprint', 2, 2);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('UIDAI🔐fingerprint', 4, 4);
        return canvas.toDataURL().slice(-32);
      } catch { return 'canvas_blocked'; }
    })(),
    // WebGL fingerprint
    (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl') as WebGLRenderingContext;
        if (!gl) return 'no_webgl';
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'no_ext';
      } catch { return 'webgl_blocked'; }
    })(),
    // Audio fingerprint
    (() => {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return 'no_audio';
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const analyser = ctx.createAnalyser();
        oscillator.connect(analyser);
        analyser.connect(ctx.destination);
        oscillator.type = 'triangle';
        oscillator.frequency.value = 10000;
        const data = new Float32Array(analyser.frequencyBinCount);
        analyser.getFloatFrequencyData(data);
        ctx.close();
        return data.slice(0, 5).join(',');
      } catch { return 'audio_blocked'; }
    })(),
  ];

  // Hash all components into a single fingerprint
  const raw = components.join('###');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).toUpperCase();
}

function collectBrowserEnv() {
  let webglRenderer = 'unavailable';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        webglRenderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      }
    }
  } catch {}

  // Check for bot indicators
  const botIndicators = {
    noPlugins: navigator.plugins.length === 0,
    noLanguages: !navigator.languages || navigator.languages.length === 0,
    webdriverPresent: !!(navigator as any).webdriver,
    phantomPresent: !!(window as any).phantom,
    nightmarePresent: !!(window as any).__nightmare,
    seleniumPresent: !!(window as any)._selenium || !!(document as any).__selenium_unwrapped,
  };

  return {
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    colorDepth: window.screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
    hardwareConcurrency: navigator.hardwareConcurrency,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    touchSupport: 'ontouchstart' in window,
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    pluginCount: navigator.plugins.length,
    webglRenderer,
    botIndicators,
    windowSize: { w: window.innerWidth, h: window.innerHeight },
    screenSize: { w: window.screen.width, h: window.screen.height },
    // Bots often have mismatched window/screen sizes
    sizeMismatch: window.innerWidth > window.screen.width || window.innerHeight > window.screen.height,
    deviceFingerprint: generateDeviceFingerprint(),
  };
}

export const useSignalCollector = () => {
  const signals = useRef<SignalData>({
    sessionId: generateSessionId(),
    mouseSignals: [],
    keystrokeSignals: [],
    scrollSignals: [],
    clickSignals: [],
    browserEnv: collectBrowserEnv(),
    timingSignals: {
      pageLoadTime: Date.now(),
      firstInteraction: null,
      firstMouseMove: null,
      firstKeyPress: null,
      firstClick: null,
    },
    behaviorSignals: {
      tabSwitches: 0,
      totalIdleTime: 0,
      lastActivityTime: Date.now(),
      mouseIdlePeriods: 0,
      rapidClicks: 0,
    }
  });

  const lastMouse = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastKeyTime = useRef<number | null>(null);
  const lastScrollY = useRef<number>(0);
  const lastScrollTime = useRef<number>(Date.now());
  const mouseDownTime = useRef<number | null>(null);
  const keyDownTimes = useRef<Record<string, number>>({});
  const lastClickTime = useRef<number>(0);

  // Mouse movement tracking
  useEffect(() => {
    let lastCapture = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastCapture < 50) return;
      lastCapture = now;

      const timing = signals.current.timingSignals as any;
      if (!timing.firstMouseMove) timing.firstMouseMove = now;
      if (!timing.firstInteraction) timing.firstInteraction = now;

      const signal: MouseSignal = { x: e.clientX, y: e.clientY, timestamp: now };
      if (lastMouse.current) {
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        const dt = now - lastMouse.current.t;
        signal.velocity = Math.sqrt(dx * dx + dy * dy) / (dt + 1);

        // Track idle periods
        if (dt > 2000) {
          (signals.current.behaviorSignals as any).mouseIdlePeriods++;
          (signals.current.behaviorSignals as any).totalIdleTime += dt;
        }
      }

      signals.current.mouseSignals.push(signal);
      if (signals.current.mouseSignals.length > 300) signals.current.mouseSignals.shift();
      lastMouse.current = { x: e.clientX, y: e.clientY, t: now };
      (signals.current.behaviorSignals as any).lastActivityTime = now;
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Click tracking
  useEffect(() => {
    const handleMouseDown = () => { mouseDownTime.current = Date.now(); };
    const handleMouseUp = (e: MouseEvent) => {
      const now = Date.now();
      const duration = mouseDownTime.current ? now - mouseDownTime.current : 0;

      const timing = signals.current.timingSignals as any;
      if (!timing.firstClick) timing.firstClick = now;
      if (!timing.firstInteraction) timing.firstInteraction = now;

      // Detect rapid clicks (bot behavior)
      if (now - lastClickTime.current < 100) {
        (signals.current.behaviorSignals as any).rapidClicks++;
      }
      lastClickTime.current = now;

      signals.current.clickSignals.push({ x: e.clientX, y: e.clientY, timestamp: now, duration });
      if (signals.current.clickSignals.length > 50) signals.current.clickSignals.shift();
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Keystroke tracking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keyDownTimes.current[e.key] = Date.now();
      const timing = signals.current.timingSignals as any;
      if (!timing.firstKeyPress) timing.firstKeyPress = Date.now();
      if (!timing.firstInteraction) timing.firstInteraction = Date.now();

      if (lastKeyTime.current !== null) {
        const flightTime = Date.now() - lastKeyTime.current;
        signals.current.keystrokeSignals.push({
          key: classifyKeyType(e.key),
          dwellTime: 0,
          flightTime,
          timestamp: Date.now(),
        });
      }
      lastKeyTime.current = Date.now();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const downTime = keyDownTimes.current[e.key];
      if (downTime && signals.current.keystrokeSignals.length > 0) {
        const last = signals.current.keystrokeSignals[signals.current.keystrokeSignals.length - 1];
        last.dwellTime = Date.now() - downTime;
      }
      delete keyDownTimes.current[e.key];
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Scroll tracking
  useEffect(() => {
    const handleScroll = () => {
      const now = Date.now();
      const currentY = window.scrollY;
      const dt = now - lastScrollTime.current;
      const dy = Math.abs(currentY - lastScrollY.current);
      const speed = dy / (dt + 1);

      signals.current.scrollSignals.push({ scrollY: currentY, timestamp: now, speed });
      if (signals.current.scrollSignals.length > 100) signals.current.scrollSignals.shift();

      lastScrollY.current = currentY;
      lastScrollTime.current = now;
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Tab visibility tracking
  // Copy paste detection
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const pastedText = e.clipboardData?.getData('text') || '';
      const behavior = signals.current.behaviorSignals as any;
      behavior.copyPasteCount = (behavior.copyPasteCount || 0) + 1;
      if (!behavior.pasteEvents) behavior.pasteEvents = [];
      behavior.pasteEvents.push(pastedText.length);
      // Track paste count in sessionStorage for UI
      const currentCount = parseInt(sessionStorage.getItem('paste_count') || '0');
      sessionStorage.setItem('paste_count', String(currentCount + 1));
      // Penalize natural typing score based on paste length
      if (pastedText.length > 5) {
        behavior.naturalTypingScore = Math.max(0, behavior.naturalTypingScore - 20);
      }
    };

    const handleCopy = () => {
      const behavior = signals.current.behaviorSignals as any;
      behavior.copyPasteCount++;
    };

    const handleContextMenu = () => {
      // Right click can indicate manual interaction (human behavior)
      const behavior = signals.current.behaviorSignals as any;
      behavior.naturalTypingScore = Math.min(100, behavior.naturalTypingScore + 5);
    };

    document.addEventListener('paste', handlePaste);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  const submitSignals = useCallback(async () => {
    const now = Date.now();
    const timing = signals.current.timingSignals as any;
    const payload = {
      ...signals.current,
      timingSignals: {
        ...timing,
        totalDuration: now - timing.pageLoadTime,
        timeToFirstInteraction: timing.firstInteraction ? timing.firstInteraction - timing.pageLoadTime : null,
        timeToFirstMouseMove: timing.firstMouseMove ? timing.firstMouseMove - timing.pageLoadTime : null,
        timeToFirstClick: timing.firstClick ? timing.firstClick - timing.pageLoadTime : null,
      },
    };

    const response = await fetch('https://uidai-passive-bot-detection.onrender.com/api/verify-human', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return response.json();
  }, []);

  const resetSignals = useCallback(() => {
    signals.current = {
      sessionId: generateSessionId(),
      mouseSignals: [],
      keystrokeSignals: [],
      scrollSignals: [],
      clickSignals: [],
      browserEnv: collectBrowserEnv(),
      timingSignals: {
        pageLoadTime: Date.now(),
        firstInteraction: null,
        firstMouseMove: null,
        firstKeyPress: null,
        firstClick: null,
      },
      behaviorSignals: {
        tabSwitches: 0,
        totalIdleTime: 0,
        lastActivityTime: Date.now(),
        mouseIdlePeriods: 0,
        rapidClicks: 0,
        copyPasteCount: 0,
        naturalTypingScore: 100,
        pasteEvents: [] as number[],
      }
    };
    lastMouse.current = null;
    lastKeyTime.current = null;
    lastScrollY.current = 0;
    lastClickTime.current = 0;
  }, []);

  return { submitSignals, resetSignals };
};