import numpy as np
from typing import List, Dict, Any


def extract_features(payload: Dict[str, Any]) -> np.ndarray:
    mouse = payload.get('mouseSignals', [])
    keys = payload.get('keystrokeSignals', [])
    env = payload.get('browserEnv', {})
    timing = payload.get('timingSignals', {})
    behavior = payload.get('behaviorSignals', {})
    clicks = payload.get('clickSignals', [])
    scrolls = payload.get('scrollSignals', [])

    features = []

    # --- Mouse features ---
    if len(mouse) > 5:
        velocities = [s.get('velocity', 0) for s in mouse if s.get('velocity')]
        features += [
            np.mean(velocities) if velocities else 0,
            np.std(velocities) if velocities else 0,
            compute_curvature(mouse),
            count_direction_changes(mouse),
            count_pauses(mouse),
            np.var(velocities) if velocities else 0,
            max(velocities) if velocities else 0,
            min(velocities) if velocities else 0,
        ]
    else:
        features += [0, 0, 0, 0, 0, 0, 0, 0]

    # --- Keystroke features ---
    if len(keys) > 3:
        dwells = [k['dwellTime'] for k in keys if k.get('dwellTime', 0) > 0]
        flights = [k['flightTime'] for k in keys if k.get('flightTime', 0) > 0]
        features += [
            np.mean(dwells) if dwells else 0,
            np.std(dwells) if dwells else 0,
            np.mean(flights) if flights else 0,
            np.std(flights) if flights else 0,
            compute_typing_rhythm(dwells),
            max(dwells) if dwells else 0,
            min(dwells) if dwells else 0,
        ]
    else:
        features += [0, 0, 0, 0, 0, 0, 0]

    # --- Click features ---
    if len(clicks) > 0:
        durations = [c.get('duration', 0) for c in clicks]
        features += [
            len(clicks),
            np.mean(durations) if durations else 0,
            np.std(durations) if durations else 0,
            behavior.get('rapidClicks', 0),
        ]
    else:
        features += [0, 0, 0, 0]

    # --- Scroll features ---
    if len(scrolls) > 2:
        speeds = [s.get('speed', 0) for s in scrolls]
        features += [
            len(scrolls),
            np.mean(speeds) if speeds else 0,
            np.std(speeds) if speeds else 0,
        ]
    else:
        features += [0, 0, 0]

    # --- Timing features ---
    page_load = timing.get('pageLoadTime', 0)
    first_interact = timing.get('firstInteraction') or (page_load + 99999)
    first_mouse = timing.get('timeToFirstMouseMove') or 99999
    first_click = timing.get('timeToFirstClick') or 99999

    features += [
        min((first_interact - page_load) / 1000, 120),
        min(first_mouse / 1000, 120) if first_mouse != 99999 else 99,
        min(first_click / 1000, 120) if first_click != 99999 else 99,
        timing.get('totalDuration', 0) / 1000,
    ]

    # --- Behavior features ---
    features += [
        behavior.get('tabSwitches', 0),
        behavior.get('mouseIdlePeriods', 0),
        min(behavior.get('totalIdleTime', 0) / 1000, 120),
        behavior.get('rapidClicks', 0),
    ]

    # --- Browser environment features ---
    bot_indicators = env.get('botIndicators', {})
    bot_score = sum([
        int(bot_indicators.get('noPlugins', False)),
        int(bot_indicators.get('webdriverPresent', False)),
        int(bot_indicators.get('phantomPresent', False)),
        int(bot_indicators.get('nightmarePresent', False)),
        int(bot_indicators.get('seleniumPresent', False)),
        int(env.get('sizeMismatch', False)),
    ])

    features += [
        int(is_headless(env)),
        int(env.get('touchSupport', False)),
        min(env.get('hardwareConcurrency', 1), 32),
        min(env.get('pixelRatio', 1), 4),
        int(env.get('webglRenderer', '') not in ['unavailable', 'error', '']),
        env.get('pluginCount', 0),
        bot_score,
        int(bot_indicators.get('webdriverPresent', False)),
        int(bot_indicators.get('noPlugins', False)),
    ]

    return np.array(features, dtype=np.float32)


def compute_curvature(mouse_signals: List[Dict]) -> float:
    if len(mouse_signals) < 2:
        return 0
    total_path = 0
    for i in range(1, len(mouse_signals)):
        dx = mouse_signals[i]['x'] - mouse_signals[i-1]['x']
        dy = mouse_signals[i]['y'] - mouse_signals[i-1]['y']
        total_path += np.sqrt(dx**2 + dy**2)
    start, end = mouse_signals[0], mouse_signals[-1]
    displacement = np.sqrt((end['x']-start['x'])**2 + (end['y']-start['y'])**2)
    return total_path / (displacement + 1e-6)


def count_direction_changes(mouse_signals: List[Dict]) -> int:
    changes = 0
    for i in range(2, len(mouse_signals)):
        dx1 = mouse_signals[i-1]['x'] - mouse_signals[i-2]['x']
        dx2 = mouse_signals[i]['x'] - mouse_signals[i-1]['x']
        if dx1 * dx2 < 0:
            changes += 1
    return changes


def count_pauses(mouse_signals: List[Dict], threshold_ms: int = 200) -> int:
    pauses = 0
    for i in range(1, len(mouse_signals)):
        dt = mouse_signals[i]['timestamp'] - mouse_signals[i-1]['timestamp']
        if dt > threshold_ms:
            pauses += 1
    return pauses


def compute_typing_rhythm(dwells: List[float]) -> float:
    if not dwells:
        return 0
    cv = np.std(dwells) / (np.mean(dwells) + 1e-6)
    return float(cv)


def is_headless(env: Dict) -> bool:
    renderer = env.get('webglRenderer', '').lower()
    headless_clues = ['swiftshader', 'llvmpipe', 'virtualbox', 'vmware', 'mesa offscreen']
    return any(clue in renderer for clue in headless_clues)