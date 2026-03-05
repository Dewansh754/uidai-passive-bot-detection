import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, roc_auc_score
import joblib

print("Starting upgraded model training...")

def generate_training_data(n_samples=20000):
    np.random.seed(42)
    n_human = n_samples // 2
    n_bot = n_samples // 2

    def human_samples(n):
        return np.column_stack([
            # Mouse features (8)
            np.random.normal(2.5, 0.8, n),     # avg velocity
            np.random.normal(1.2, 0.4, n),     # velocity std
            np.random.normal(3.5, 1.0, n),     # curvature
            np.random.normal(15, 5, n),         # direction changes
            np.random.normal(3, 1.5, n),        # pauses
            np.random.normal(0.8, 0.3, n),      # speed variance
            np.random.normal(5.0, 1.5, n),      # max velocity
            np.random.normal(0.5, 0.2, n),      # min velocity
            # Keystroke features (7)
            np.random.normal(120, 30, n),       # avg dwell
            np.random.normal(35, 15, n),        # dwell std
            np.random.normal(180, 50, n),       # avg flight
            np.random.normal(60, 25, n),        # flight std
            np.random.normal(0.5, 0.15, n),    # typing rhythm
            np.random.normal(200, 50, n),       # max dwell
            np.random.normal(60, 20, n),        # min dwell
            # Click features (4)
            np.random.normal(3, 2, n),          # click count
            np.random.normal(150, 50, n),       # avg click duration
            np.random.normal(40, 15, n),        # click duration std
            np.zeros(n),                         # rapid clicks
            # Scroll features (3)
            np.random.normal(5, 3, n),          # scroll count
            np.random.normal(0.5, 0.2, n),      # avg scroll speed
            np.random.normal(0.2, 0.1, n),      # scroll speed std
            # Timing features (4)
            np.random.normal(3.5, 2.0, n),      # time to first interact
            np.random.normal(2.0, 1.5, n),      # time to first mouse
            np.random.normal(4.0, 2.0, n),      # time to first click
            np.random.normal(45, 20, n),         # total duration
            # Behavior features (4)
            np.random.normal(1, 0.5, n),        # tab switches
            np.random.normal(2, 1, n),          # mouse idle periods
            np.random.normal(5, 3, n),          # total idle time
            np.zeros(n),                         # rapid clicks behavior
            # Browser features (9)
            np.zeros(n),                         # is_headless
            np.random.binomial(1, 0.4, n),      # touch support
            np.random.choice([2,4,6,8], n),     # cpu cores
            np.random.choice([1,2,3], n),       # pixel ratio
            np.ones(n),                          # webgl available
            np.random.normal(5, 2, n),           # plugin count
            np.zeros(n),                         # bot score
            np.zeros(n),                         # webdriver
            np.zeros(n),                         # no plugins flag
        ])

    def bot_samples(n):
        return np.column_stack([
            # Mouse features (8)
            np.random.normal(8.0, 0.3, n),      # very uniform velocity
            np.random.normal(0.05, 0.02, n),    # very low std
            np.random.normal(1.01, 0.01, n),    # straight lines
            np.random.normal(1, 0.5, n),        # few direction changes
            np.zeros(n),                         # no pauses
            np.random.normal(0.005, 0.002, n),  # near zero variance
            np.random.normal(8.1, 0.3, n),      # max = avg (robotic)
            np.random.normal(7.9, 0.3, n),      # min = avg (robotic)
            # Keystroke features (7)
            np.random.normal(40, 3, n),          # very fast uniform dwell
            np.random.normal(2, 0.5, n),         # very low std
            np.random.normal(80, 3, n),          # very uniform flight
            np.random.normal(2, 0.5, n),         # very low std
            np.random.normal(0.03, 0.01, n),    # very regular
            np.random.normal(42, 3, n),          # max ≈ avg
            np.random.normal(38, 3, n),          # min ≈ avg
            # Click features (4)
            np.random.normal(1, 0.5, n),         # very few clicks
            np.random.normal(20, 5, n),          # very short click duration
            np.random.normal(2, 0.5, n),         # very low std
            np.random.normal(3, 1, n),           # rapid clicks
            # Scroll features (3)
            np.zeros(n),                         # no scrolling
            np.zeros(n),                         # no scroll speed
            np.zeros(n),                         # no scroll variance
            # Timing features (4)
            np.random.normal(0.1, 0.05, n),     # instant interaction
            np.random.normal(99, 1, n),          # no mouse move (99=none)
            np.random.normal(0.1, 0.05, n),     # instant click
            np.random.normal(2, 1, n),           # very fast session
            # Behavior features (4)
            np.zeros(n),                         # no tab switches
            np.zeros(n),                         # no idle periods
            np.zeros(n),                         # no idle time
            np.random.normal(3, 1, n),           # rapid clicks
            # Browser features (9)
            np.random.binomial(1, 0.7, n),      # often headless
            np.zeros(n),                         # no touch
            np.random.choice([4, 8, 16], n),    # high cpu
            np.ones(n),                          # pixel ratio = 1
            np.random.binomial(1, 0.3, n),      # often no webgl
            np.zeros(n),                         # no plugins
            np.random.normal(3, 1, n),           # high bot score
            np.random.binomial(1, 0.6, n),      # webdriver present
            np.random.binomial(1, 0.8, n),      # no plugins flag
        ])

    X_human = human_samples(n_human)
    X_bot = bot_samples(n_bot)
    X = np.vstack([X_human, X_bot])
    y = np.array([1]*n_human + [0]*n_bot)
    X = np.clip(X, 0, None)
    return X, y


print("Generating training data (20,000 samples)...")
X, y = generate_training_data(20000)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)

print("Training upgraded ML model...")
model = Pipeline([
    ('scaler', StandardScaler()),
    ('clf', GradientBoostingClassifier(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        min_samples_split=10,
        random_state=42
    ))
])

model.fit(X_train, y_train)

y_pred = model.predict(X_test)
y_prob = model.predict_proba(X_test)[:, 1]

print("\n========== Upgraded Model Performance ==========")
print(classification_report(y_test, y_pred, target_names=['Bot', 'Human']))
print(f"AUC-ROC Score: {roc_auc_score(y_test, y_prob):.4f}")
print("=================================================")

joblib.dump(model, '../backend/bot_detector_model.pkl')
print("\nUpgraded model saved to backend folder!")
print("Training complete!")