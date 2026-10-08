"""Train the invest/pass model and write the two files the app ships.

    cd ml && uv run python -m invest_model.train

Steps:
  1. Clean the raw export (invest_model.clean).
  2. Estimate how well the whole recipe works on pitch sessions it has never
     seen: forward chaining over the newest sessions (trained on the past
     only), then nested, session-grouped cross-validation.
  3. Run the same recipe once on all rows: choose hyperparameters, set the
     acceptance gate from out-of-fold scores, then refit on everything.
  4. Export to ONNX with the gate built in, check parity with scikit-learn,
     and write lib/invest/model.onnx plus lib/invest/model-card.json.

The model is a gradient-boosted *regressor* fitted to y in {0, 1}. Under
squared error it estimates E[y | x], the invest rate among decks scored like
this one, so its output is a graded score instead of a hard class. The
acceptance gate is the cut-off on that score where a deck becomes an
"invest". It is set from held-out scores, not fixed at 0.5.
"""

from __future__ import annotations

import itertools
import json
import platform
import time
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime
from importlib.metadata import version

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    brier_score_loss,
    f1_score,
    matthews_corrcoef,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupKFold
from threadpoolctl import threadpool_limits

from invest_model import clean, config, export

# --- Recipe ------------------------------------------------------------------

# The six criteria are "higher is better" by construction. Constraining the
# score to never fall as a criterion rises stops the trees from learning
# noise like "a 4 on Team is worse than a 3". Funding (the last column) is
# left free: a seed-stage deck and a late-stage one can both be passes.
MONOTONIC = {
    "criteria": [1, 1, 1, 1, 1, 1, 0],
    "none": [0, 0, 0, 0, 0, 0, 0],
}

# Small on purpose. There are ~770 rows and the criteria take five values each,
# so deep or wide trees only memorise: four-leaf trees with a strong L2 penalty
# beat wider ones on the newest sessions and tie them in CV. Only the number of
# rounds is left to choose, by session-grouped CV inside each training fold.
GRID: dict[str, list] = {
    "learning_rate": [0.05],
    "max_iter": [100, 250],
    "max_leaf_nodes": [4],
    "min_samples_leaf": [10],
    "l2_regularization": [5.0],
    "monotonic": ["criteria"],
}

# Recency: a deck's weight halves for every RECENCY_HALF_LIFE sessions between
# its session and the newest one being fitted. The bar moved over the season
# (the same ratings earned fewer invests later on), so the fit leans toward the
# recent bar without throwing the early sessions away. On the newest sessions
# it mostly fixes the overall level of the score, not the order of decks.
# Forward tests favour shorter half-lives and cross-validation favours none;
# 20 sits between. Weights only shape training; the model still sees nothing
# about dates. None turns it off.
RECENCY_HALF_LIFE: float | None = 20.0

INNER_SPLITS = 5
OUTER_SPLITS = 5
OUTER_REPEATS = 10

# Forward chaining: replay the newest sessions one at a time, each scored by a
# model trained only on the sessions before it. The pooled result is reported
# for all of them and for the newest FORWARD_RECENT.
FORWARD_SESSIONS = 8
FORWARD_RECENT = 5
BOOTSTRAP_DRAWS = 2000


# --- Data ----------------------------------------------------------------------


@dataclass(frozen=True)
class Rows:
    """The training table as row-aligned arrays."""

    X: np.ndarray
    y: np.ndarray
    sessions: np.ndarray
    startups: np.ndarray
    dates: np.ndarray
    ranks: np.ndarray  # the session's place in date order, 0 = oldest

    @classmethod
    def from_table(cls, table: pd.DataFrame) -> Rows:
        dates = table["session_date"].to_numpy()
        return cls(
            X=table[list(config.FEATURES)].to_numpy(dtype=np.float64),
            y=table["label"].to_numpy(dtype=np.float64),
            sessions=table["session"].to_numpy(),
            startups=table["startup"].to_numpy(),
            dates=dates,
            ranks=np.unique(dates, return_inverse=True)[1],
        )

    def take(self, idx: np.ndarray) -> Rows:
        return Rows(*(a[idx] for a in (self.X, self.y, self.sessions, self.startups, self.dates, self.ranks)))

    def __len__(self) -> int:
        return len(self.y)


# --- Cross-validation ----------------------------------------------------------


def session_folds(rows: Rows, n_splits: int, seed: int) -> Iterator[tuple[np.ndarray, np.ndarray]]:
    """K folds of whole pitch sessions, purged of repeat startups.

    Each test fold is a set of complete sessions, so the model is always scored
    on sessions it never trained on. A startup that pitched more than once may
    also turn up in a training session, so those rows are removed from the
    training side; otherwise the model could simply recognise it.
    """
    splitter = GroupKFold(n_splits=n_splits, shuffle=True, random_state=seed)
    for train_idx, test_idx in splitter.split(rows.X, groups=rows.sessions):
        seen_in_test = np.isin(rows.startups[train_idx], rows.startups[test_idx])
        yield train_idx[~seen_in_test], test_idx


@dataclass(frozen=True)
class Recipe:
    learning_rate: float
    max_iter: int
    max_leaf_nodes: int
    min_samples_leaf: int
    l2_regularization: float
    monotonic: str

    def build(self) -> HistGradientBoostingRegressor:
        return HistGradientBoostingRegressor(
            loss="squared_error",
            learning_rate=self.learning_rate,
            max_iter=self.max_iter,
            max_leaf_nodes=self.max_leaf_nodes,
            min_samples_leaf=self.min_samples_leaf,
            l2_regularization=self.l2_regularization,
            monotonic_cst=MONOTONIC[self.monotonic],
            early_stopping=False,
            random_state=config.SEED,
        )


RECIPES = [Recipe(**dict(zip(GRID, combo, strict=True))) for combo in itertools.product(*GRID.values())]


def recency_weights(ranks: np.ndarray) -> np.ndarray | None:
    """Sample weights for one fit, from the session ranks of the rows in it.

    Normalised to mean 1, because HistGradientBoosting's l2_regularization is
    not scaled by the weights: without it, the penalty would grow as the
    weights shrink. After normalising, only the gaps between sessions matter,
    not which session counts as "now".
    """
    if RECENCY_HALF_LIFE is None:
        return None
    w = 0.5 ** ((ranks.max() - ranks) / RECENCY_HALF_LIFE)
    return w / w.mean()


def fit(recipe: Recipe, rows: Rows) -> HistGradientBoostingRegressor:
    return recipe.build().fit(rows.X, rows.y, sample_weight=recency_weights(rows.ranks))


def score(model: HistGradientBoostingRegressor, X: np.ndarray) -> np.ndarray:
    return np.clip(model.predict(X), 0.0, 1.0)


def oof_scores(recipe: Recipe, rows: Rows, seed: int) -> np.ndarray:
    scores = np.full(len(rows), np.nan)
    for train_idx, test_idx in session_folds(rows, INNER_SPLITS, seed):
        scores[test_idx] = score(fit(recipe, rows.take(train_idx)), rows.X[test_idx])
    return scores


# --- The acceptance gate -------------------------------------------------------


def gate_for(y: np.ndarray, scores: np.ndarray) -> float:
    """The acceptance gate: invest in as large a share of decks as William did.

    It is the (1 - invest rate) quantile of out-of-fold scores, so on held-out
    decks from the training sessions it says "invest" as often as the labels
    did (~26%), and the score decides *which* decks. The reviewer worked to
    roughly that share session after session. A gate tuned to maximise MCC
    instead moved about twice as much between resamples, and in the forward
    replay it more than doubled William's invests in some of the newest
    sessions.

    The share is fixed at training time. Newer decks score a little higher
    than older ones, so on the newest sessions this gate invests in about 30%
    against William's 25% (forward_chain() reports it), and it won't follow a
    stricter or looser bar until the model is retrained. Unweighted on
    purpose: the recency weights shape the scores, not the share.
    """
    return float(np.quantile(scores, 1.0 - y.mean()))


def select(rows: Rows, seed: int) -> tuple[Recipe, float, np.ndarray]:
    """Pick the recipe with the lowest out-of-fold Brier score, then set its gate.

    Brier (mean squared error on 0/1) is the loss the regressor itself fits, and
    it doesn't depend on any threshold, so recipe choice and gate choice don't
    interact. Unweighted, so every held-out deck counts the same. Returns the
    recipe, the gate, and the out-of-fold scores.
    """
    best: tuple[float, Recipe, np.ndarray] | None = None
    for recipe in RECIPES:
        scores = oof_scores(recipe, rows, seed)
        brier = float(np.mean((scores - rows.y) ** 2))
        if best is None or brier < best[0]:
            best = (brier, recipe, scores)
    assert best is not None
    _, recipe, scores = best
    return recipe, gate_for(rows.y, scores), scores


# --- Metrics -------------------------------------------------------------------


def metrics(y: np.ndarray, scores: np.ndarray, invest: np.ndarray) -> dict[str, float]:
    return {
        "accuracy": accuracy_score(y, invest),
        "balanced_accuracy": balanced_accuracy_score(y, invest),
        "precision": precision_score(y, invest, zero_division=0.0),
        "recall": recall_score(y, invest, zero_division=0.0),
        "f1": f1_score(y, invest, zero_division=0.0),
        "mcc": matthews_corrcoef(y, invest),
        "invest_rate": float(np.mean(invest)),
        "roc_auc": roc_auc_score(y, scores),
        "average_precision": average_precision_score(y, scores),
        "brier": brier_score_loss(y, scores),
    }


def criteria_sum_auc(rows: Rows) -> float:
    """AUC of the plain sum of the six ratings: the rule the model has to beat."""
    return roc_auc_score(rows.y, np.nansum(rows.X[:, :6], axis=1))


def evaluate(rows: Rows) -> dict[str, object]:
    """Nested CV: the whole recipe (selection + gate) re-run inside each outer fold.

    Every number here comes from sessions the selection, the gate and the fit
    never saw. Repeated with different session-to-fold assignments, because ~20
    sessions make any single split noisy. CV mixes early and late sessions, so
    it can't see drift; forward_chain() can.
    """
    per_repeat: list[dict[str, float]] = []
    prior_brier: list[float] = []
    gates: list[float] = []
    chosen: list[Recipe] = []
    confusion = np.zeros((2, 2), dtype=int)
    for repeat in range(OUTER_REPEATS):
        seed = config.SEED + 1000 * (repeat + 1)
        scores = np.full(len(rows), np.nan)
        prior = np.full(len(rows), np.nan)
        invest = np.zeros(len(rows), dtype=bool)
        for fold, (train_idx, test_idx) in enumerate(session_folds(rows, OUTER_SPLITS, seed)):
            train = rows.take(train_idx)
            recipe, gate, _ = select(train, seed + fold + 1)
            scores[test_idx] = score(fit(recipe, train), rows.X[test_idx])
            prior[test_idx] = train.y.mean()
            invest[test_idx] = scores[test_idx] >= gate
            gates.append(gate)
            chosen.append(recipe)
        per_repeat.append(metrics(rows.y, scores, invest))
        prior_brier.append(brier_score_loss(rows.y, prior))
        for truth, pred in zip(rows.y.astype(int), invest.astype(int), strict=True):
            confusion[truth, pred] += 1
        print(f"  repeat {repeat + 1}/{OUTER_REPEATS}: " + _fmt(per_repeat[-1]))

    summary = {
        k: {
            "mean": float(np.mean([m[k] for m in per_repeat])),
            "sd": float(np.std([m[k] for m in per_repeat], ddof=1)),
        }
        for k in per_repeat[0]
    }
    return {
        "scheme": (
            f"{OUTER_REPEATS}x repeated {OUTER_SPLITS}-fold CV over whole pitch sessions "
            f"(repeat startups purged from training folds); recipe selection and the gate "
            f"re-run inside every outer fold with {INNER_SPLITS}-fold session-grouped CV"
        ),
        "metrics": summary,
        "base_rate": float(rows.y.mean()),
        "confusion_matrix": {
            "note": f"summed over {OUTER_REPEATS} repeats; rows = actual, cols = predicted",
            "pass_pass": int(confusion[0, 0]),
            "pass_invest": int(confusion[0, 1]),
            "invest_pass": int(confusion[1, 0]),
            "invest_invest": int(confusion[1, 1]),
        },
        "baselines": {
            "prior_brier": float(np.mean(prior_brier)),
            "prior_brier_note": "Brier of predicting each training fold's invest rate for every deck",
            "criteria_sum_roc_auc": criteria_sum_auc(rows),
            "always_pass": {"accuracy": float(1 - rows.y.mean()), "balanced_accuracy": 0.5, "mcc": 0.0},
        },
        "gate_across_folds": _spread(gates),
        "recipe_choices_across_folds": pd.Series([str(r) for r in chosen]).value_counts().to_dict(),
    }


def forward_chain(rows: Rows) -> dict[str, object]:
    """Replay the newest sessions in date order, the way the model is used.

    Each of the newest FORWARD_SESSIONS sessions is scored by the whole recipe
    (selection, gate, fit) run on every session before it, and nothing after.
    This is the closer match to deployment: the scores and the reviewer's
    habits both moved over the season, and CV can't see that.
    """
    order = pd.Series(rows.dates).groupby(rows.sessions).first().sort_values()
    steps = order.index[-FORWARD_SESSIONS:]
    scores = np.full(len(rows), np.nan)
    prior = np.full(len(rows), np.nan)
    invest = np.zeros(len(rows), dtype=bool)
    per_session = []
    chosen = []
    for step, session in enumerate(steps):
        before = order.index[order < order[session]]
        test_idx = np.flatnonzero(rows.sessions == session)
        train_idx = np.flatnonzero(np.isin(rows.sessions, before))
        train_idx = train_idx[~np.isin(rows.startups[train_idx], rows.startups[test_idx])]
        train = rows.take(train_idx)
        recipe, gate, _ = select(train, config.SEED + 50_000 + step)
        scores[test_idx] = score(fit(recipe, train), rows.X[test_idx])
        prior[test_idx] = train.y.mean()
        invest[test_idx] = scores[test_idx] >= gate
        y = rows.y[test_idx]
        chosen.append(recipe)
        per_session.append(
            {
                "session_date": pd.Timestamp(order[session]).date().isoformat(),
                "trained_on_sessions": len(before),
                "rows": len(test_idx),
                "invest": int(y.sum()),
                "predicted_invest": int(invest[test_idx].sum()),
                "correct": int((invest[test_idx] == y.astype(bool)).sum()),
                "gate": gate,
                "recipe": str(recipe),
                "mean_score": float(scores[test_idx].mean()),
                "brier": brier_score_loss(y, scores[test_idx]),
                "prior_brier": brier_score_loss(y, prior[test_idx]),
            }
        )
        s = per_session[-1]
        print(
            f"  {s['session_date']}: {s['correct']}/{s['rows']} right, "
            f"invested {s['predicted_invest']} vs {s['invest']} actual, gate {gate:.3f}, "
            f"brier {s['brier']:.3f} (prior {s['prior_brier']:.3f})"
        )

    def pooled(sessions: pd.Index, seed: int) -> dict[str, object]:
        held = np.isin(rows.sessions, sessions)
        return {
            "sessions": len(sessions),
            "rows": int(held.sum()),
            "metrics": metrics(rows.y[held], scores[held], invest[held]),
            "base_rate": float(rows.y[held].mean()),
            "mean_score": float(scores[held].mean()),
            "prior_brier": brier_score_loss(rows.y[held], prior[held]),
            "criteria_sum_roc_auc": criteria_sum_auc(rows.take(np.flatnonzero(held))),
            "bootstrap": _session_bootstrap(rows, scores, invest, sessions, seed),
        }

    every, recent = pooled(steps, config.SEED), pooled(steps[-FORWARD_RECENT:], config.SEED + 1)
    for label, block in ((f"newest {FORWARD_SESSIONS}", every), (f"newest {FORWARD_RECENT}", recent)):
        print(
            f"  {label}: " + _fmt(block["metrics"])
            + f"  mean score {block['mean_score']:.3f} vs rate {block['base_rate']:.3f}"
        )
    return {
        "scheme": (
            f"the newest {FORWARD_SESSIONS} sessions in date order, each scored by the whole recipe "
            f"(selection, gate, fit) trained on every earlier session only"
        ),
        **every,
        f"newest_{FORWARD_RECENT}": recent,
        "gate_across_steps": _spread([s["gate"] for s in per_session]),
        "recipe_choices_across_steps": pd.Series([str(r) for r in chosen]).value_counts().to_dict(),
        "per_session": per_session,
    }


def _session_bootstrap(
    rows: Rows, scores: np.ndarray, invest: np.ndarray, sessions: pd.Index, seed: int
) -> dict[str, dict[str, float]]:
    """Spread of the pooled metrics when whole sessions are resampled.

    With only a handful of sessions, a difference smaller than this sd is noise.
    """
    rng = np.random.default_rng(seed)
    by_session = [np.flatnonzero(rows.sessions == s) for s in sessions]
    draws: dict[str, list[float]] = {"roc_auc": [], "brier": [], "mcc": []}
    for _ in range(BOOTSTRAP_DRAWS):
        idx = np.concatenate([by_session[i] for i in rng.integers(len(sessions), size=len(sessions))])
        y = rows.y[idx]
        draws["roc_auc"].append(roc_auc_score(y, scores[idx]))
        draws["brier"].append(brier_score_loss(y, scores[idx]))
        draws["mcc"].append(matthews_corrcoef(y, invest[idx]))
    return {
        k: {"sd": float(np.std(v, ddof=1)), "p5": float(np.percentile(v, 5)), "p95": float(np.percentile(v, 95))}
        for k, v in draws.items()
    }


def near_gate(y: np.ndarray, scores: np.ndarray, gate: float) -> list[dict[str, object]]:
    """How often decks at each distance from the gate were actually invested in.

    Out-of-fold, so this is what a score just above or below the gate meant on
    decks the model hadn't seen.
    """
    edges = [-np.inf, -0.2, -0.1, -0.05, 0.0, 0.05, 0.1, 0.2, np.inf]
    out = []
    for lo, hi in itertools.pairwise(edges):
        band = (scores - gate >= lo) & (scores - gate < hi)
        out.append(
            {
                "score_minus_gate": [None if np.isinf(lo) else lo, None if np.isinf(hi) else hi],
                "rows": int(band.sum()),
                "invest_rate": float(y[band].mean()) if band.any() else None,
            }
        )
    return out


# Funding levels for the response curve, in USD. Dense around $1-2M, where
# the score drops hardest.
RESPONSE_FUNDING = [0, 1e5, 2.5e5, 5e5, 1e6, 1.25e6, 1.5e6, 1.6e6, 1.7e6, 1.8e6, 2e6, 3e6, 5e6, 1e7, 2e7, 5e7]


def model_response(model: HistGradientBoostingRegressor, gate: float, X: np.ndarray) -> dict[str, object]:
    """What moves the final model's verdict, measured on the training decks.

    Funding: every deck is re-scored at each funding level (and at unknown),
    keeping its own ratings. Ratings: each deck not already rated 5 (or
    unrated) on that criterion is re-scored one point higher; "decks" says how
    many that was. Only averages are reported, never a single row.
    """
    base = score(model, X) >= gate
    funding = []
    for value in [*RESPONSE_FUNDING, np.nan]:
        moved = X.copy()
        moved[:, -1] = value
        s = score(model, moved)
        funding.append(
            {
                "funding_usd": None if np.isnan(value) else value,
                "mean_score": float(s.mean()),
                "invest_share": float(np.mean(s >= gate)),
            }
        )
    ratings = {}
    for j, name in enumerate(config.FEATURES[:6]):
        can_rise = X[:, j] < 5
        moved = X[can_rise].copy()
        moved[:, j] += 1
        s = score(model, moved)
        ratings[name] = {
            "decks": int(can_rise.sum()),
            "mean_score_change": float(np.mean(s - score(model, X[can_rise]))),
            "verdicts_changed": float(np.mean((s >= gate) != base[can_rise])),
        }
    return {
        "funding": funding,
        "one_point_higher": ratings,
        "note": (
            "averages over the training decks, each re-scored with one input changed. "
            "funding: every deck, at each amount; funding_usd=None is the unknown branch. "
            "one_point_higher: only the decks that can go up a point on that criterion (not "
            "already 5), counted in decks"
        ),
    }


def _spread(values: list[float]) -> dict[str, float]:
    return {"min": float(np.min(values)), "median": float(np.median(values)), "max": float(np.max(values))}


def _fmt(m: dict[str, float]) -> str:
    keys = ("accuracy", "balanced_accuracy", "mcc", "roc_auc", "brier")
    return "  ".join(f"{k}={m[k]:.3f}" for k in keys)


# --- Entry point ---------------------------------------------------------------


def main() -> None:
    started = time.time()
    data = clean.load()
    rows = Rows.from_table(data.table)
    print(
        f"{len(rows)} rows, {int(rows.y.sum())} invest / {int(len(rows) - rows.y.sum())} pass, "
        f"{len(np.unique(rows.sessions))} sessions, {len(RECIPES)} recipes, "
        f"recency half-life {RECENCY_HALF_LIFE} sessions"
    )

    print(f"Forward chaining (newest {FORWARD_SESSIONS} sessions, trained on the past only):")
    forward = forward_chain(rows)

    print("Nested evaluation (held-out sessions):")
    evaluation = evaluate(rows)
    print("  mean: " + _fmt({k: v["mean"] for k, v in evaluation["metrics"].items()}))

    print("Final fit on all rows:")
    recipe, gate, final_oof = select(rows, config.SEED)
    model = fit(recipe, rows)
    oof_at_gate = metrics(rows.y, final_oof, final_oof >= gate)
    order = pd.Series(rows.dates).groupby(rows.sessions).first().sort_values()
    newest = np.isin(rows.sessions, order.index[-FORWARD_SESSIONS:])
    print(f"  {recipe}\n  gate = {gate:.3f}  (out-of-fold: {_fmt(oof_at_gate)})")
    print(
        f"  out-of-fold invest share, newest {FORWARD_SESSIONS} sessions: "
        f"{np.mean(final_oof[newest] >= gate):.3f} vs William {rows.y[newest].mean():.3f}"
    )

    onx = export.build_onnx(model, gate)
    parity = export.check_parity(model, gate, onx, rows.X)
    export.save_onnx(onx, config.MODEL_OUT)
    print(f"  wrote {config.MODEL_OUT.relative_to(config.REPO_ROOT)}  parity: {parity}")

    _write_parity_fixture(model, gate, rows.X)

    probes = {
        "nothing_rated": np.full(len(config.FEATURES), np.nan),
        "all_criteria_1_nothing_raised": np.array([1, 1, 1, 1, 1, 1, 0.0]),
        "all_criteria_5_raised_5m": np.array([5, 5, 5, 5, 5, 5, 5e6]),
    }
    card = {
        "model": "HistGradientBoostingRegressor (squared error) on Invest William, 1 = invest",
        "output": {
            "score": "float in [0, 1]: estimated invest rate for decks scored like this one",
            "invest": "1 if score >= threshold else 0",
            "threshold": "the acceptance gate, set from held-out scores",
        },
        "features": list(config.FEATURES),
        "missing_values": (
            "NaN = not rated / not known; the trees route it explicitly. Only 2 training rows "
            "missed a criterion, so the app requires all six and only lets funding be unknown"
        ),
        "recipe": {**recipe.__dict__, "monotonic_cst": MONOTONIC[recipe.monotonic]},
        "training_weights": {
            "recency_half_life_sessions": RECENCY_HALF_LIFE,
            "rule": "weight = 0.5 ** (sessions before the newest fitted session / half-life), mean 1 per fit",
            "oldest_vs_newest": (
                None if RECENCY_HALF_LIFE is None else 0.5 ** (int(rows.ranks.max()) / RECENCY_HALF_LIFE)
            ),
        },
        "gate": {
            "threshold": gate,
            "rule": (
                "the (1 - invest rate) quantile of out-of-fold scores: the model invests in the "
                "same share of held-out decks as the training labels did"
            ),
            "invest_rate_in_training": float(rows.y.mean()),
            "tuned_on": "out-of-fold scores from session-grouped CV on all training rows",
            "out_of_fold_metrics_at_gate": oof_at_gate,
            "out_of_fold_by_distance_from_gate": near_gate(rows.y, final_oof, gate),
            f"out_of_fold_newest_{FORWARD_SESSIONS}_sessions": {
                "invest_share": float(np.mean(final_oof[newest] >= gate)),
                "william_share": float(rows.y[newest].mean()),
            },
        },
        "response": model_response(model, gate, rows.X),
        "forward_chaining": forward,
        "evaluation": evaluation,
        "probes": {name: float(score(model, x[None, :])[0]) for name, x in probes.items()},
        "data": data.summary,
        "onnx_parity": parity,
        "trained": {
            "at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "seconds": round(time.time() - started, 1),
            "python": platform.python_version(),
            **{pkg: version(pkg) for pkg in ("scikit-learn", "skl2onnx", "onnx", "onnxruntime", "numpy", "pandas")},
        },
    }
    config.CARD_OUT.write_text(json.dumps(_round(card), indent=2) + "\n")
    print(f"  wrote {config.CARD_OUT.relative_to(config.REPO_ROOT)}")
    print(f"Done in {time.time() - started:.0f}s. Next: node ml/scripts/check-onnx.mjs (from the repo root).")


def _write_parity_fixture(model: HistGradientBoostingRegressor, gate: float, X: np.ndarray) -> None:
    """Expected outputs for ml/scripts/check-onnx.mjs.

    The rows are real feature vectors, so this goes to the gitignored
    processed/ folder. It never contains names.
    """
    rows = np.vstack(
        [
            X,
            np.full((1, X.shape[1]), np.nan),  # nothing rated at all
            [[1, 1, 1, 1, 1, 1, 0]],
            [[5, 5, 5, 5, 5, 5, 5e6]],
        ]
    ).astype(np.float32)
    expected = score(model, rows.astype(np.float64))
    config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "features": list(config.FEATURES),
        "threshold": gate,
        "rows": [[None if np.isnan(v) else float(v) for v in row] for row in rows],
        "score": expected.tolist(),
    }
    (config.PROCESSED_DIR / "parity.json").write_text(json.dumps(payload))


def _round(obj: object) -> object:
    if isinstance(obj, float):
        return round(obj, 4)
    if isinstance(obj, dict):
        return {k: _round(v) for k, v in obj.items()}
    if isinstance(obj, list | tuple):
        return [_round(v) for v in obj]
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return round(float(obj), 4)
    return obj


if __name__ == "__main__":
    # Thousands of tiny fits: OpenMP's per-fit thread start-up costs more than
    # the work it spreads (one thread is ~10x faster here), and results are the same.
    with threadpool_limits(limits=1, user_api="openmp"):
        main()
