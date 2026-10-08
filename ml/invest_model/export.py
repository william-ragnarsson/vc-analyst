"""Fitted regressor + acceptance gate -> the single ONNX file the app runs.

The graph skl2onnx produces outputs one raw regression value per row. Three
nodes are appended so the file carries the whole decision, not just the score:

    score     = Clip(raw, 0, 1)           float32 [N, 1]
    invest    = Cast(score >= threshold)  int64   [N, 1]   1 = invest, 0 = pass
    threshold = the gate itself           float32 [1]

Putting the gate inside the graph means the app cannot drift out of sync with
the threshold the model was tuned for: there is no second number to update.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import onnx
import skl2onnx.common.tree_ensemble as _tree_ensemble
from onnx import TensorProto, helper
from skl2onnx import to_onnx
from skl2onnx.common.data_types import FloatTensorType
from sklearn.ensemble import HistGradientBoostingRegressor

from invest_model.config import FEATURES, ONNX_INPUT

# Opsets onnxruntime-node 1.27 (the app's runtime) executes; verified by
# tests/test_export.py here and by ml/scripts/check-onnx.mjs under Node.
TARGET_OPSET = {"": 17, "ai.onnx.ml": 3}


# skl2onnx 1.20 passes a Python bool for `nodes_missing_value_tracks_true` on
# leaf nodes, which protobuf now rejects ("Expected an int, got a boolean"). The
# value is only ever 0/1, so coerce it. Without this, any HistGradientBoosting
# model fails to convert.
_original_add_node = _tree_ensemble.add_node


def _add_node_int_missing(*args, nodes_missing_value_tracks_true=0, **kwargs):
    return _original_add_node(
        *args, nodes_missing_value_tracks_true=int(nodes_missing_value_tracks_true), **kwargs
    )


_tree_ensemble.add_node = _add_node_int_missing


def build_onnx(model: HistGradientBoostingRegressor, threshold: float) -> onnx.ModelProto:
    """Convert ``model`` and append the clip + gate nodes."""
    if not 0.0 < threshold < 1.0:
        raise ValueError(f"threshold must be inside (0, 1), got {threshold}")

    onx = to_onnx(
        model,
        initial_types=[(ONNX_INPUT, FloatTensorType([None, len(FEATURES)]))],
        target_opset=TARGET_OPSET,
    )

    # skl2onnx can list the default domain twice; keep one entry per domain.
    seen: dict[str, int] = {}
    for opset in onx.opset_import:
        seen[opset.domain] = max(seen.get(opset.domain, 0), opset.version)
    del onx.opset_import[:]
    onx.opset_import.extend(helper.make_opsetid(d, v) for d, v in sorted(seen.items()))

    graph = onx.graph
    raw = graph.output[0].name
    graph.initializer.extend(
        [
            helper.make_tensor("score_min", TensorProto.FLOAT, [], [0.0]),
            helper.make_tensor("score_max", TensorProto.FLOAT, [], [1.0]),
            helper.make_tensor("gate", TensorProto.FLOAT, [], [threshold]),
            helper.make_tensor("gate_vec", TensorProto.FLOAT, [1], [threshold]),
        ]
    )
    graph.node.extend(
        [
            helper.make_node("Clip", [raw, "score_min", "score_max"], ["score"]),
            helper.make_node("GreaterOrEqual", ["score", "gate"], ["invest_bool"]),
            helper.make_node("Cast", ["invest_bool"], ["invest"], to=TensorProto.INT64),
            helper.make_node("Identity", ["gate_vec"], ["threshold"]),
        ]
    )
    del graph.output[:]
    graph.output.extend(
        [
            helper.make_tensor_value_info("score", TensorProto.FLOAT, [None, 1]),
            helper.make_tensor_value_info("invest", TensorProto.INT64, [None, 1]),
            helper.make_tensor_value_info("threshold", TensorProto.FLOAT, [1]),
        ]
    )

    onx.doc_string = (
        "SevenFold invest/pass model: HistGradientBoostingRegressor on Invest William (0/1), "
        f"acceptance gate at score >= {threshold:.6f}. Input order: {', '.join(FEATURES)}."
    )
    onnx.helper.set_model_props(
        onx, {"features": ",".join(FEATURES), "threshold": repr(float(threshold))}
    )
    onnx.checker.check_model(onx, full_check=True)
    return onx


def save_onnx(onx: onnx.ModelProto, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    onnx.save(onx, str(path))


def check_parity(
    model: HistGradientBoostingRegressor,
    threshold: float,
    onx: onnx.ModelProto,
    X: np.ndarray,
    atol: float = 1e-5,
) -> dict[str, float]:
    """Run the ONNX graph on ``X`` and compare it with scikit-learn row by row.

    Raises if any score differs by more than ``atol`` or any gate decision
    differs on a row that is not within ``atol`` of the threshold (float32
    rounding can legitimately flip a score sitting exactly on the gate).
    """
    import onnxruntime as ort

    session = ort.InferenceSession(onx.SerializeToString(), providers=["CPUExecutionProvider"])
    score, invest, gate = session.run(
        ["score", "invest", "threshold"], {ONNX_INPUT: X.astype(np.float32)}
    )

    # Compare against scikit-learn on the same float32-rounded inputs.
    expected = np.clip(model.predict(X.astype(np.float32).astype(np.float64)), 0.0, 1.0)
    diff = np.abs(score[:, 0].astype(np.float64) - expected)
    expected_invest = (expected >= threshold).astype(np.int64)
    near_gate = np.abs(expected - threshold) <= atol
    flips = int(np.sum((invest[:, 0] != expected_invest) & ~near_gate))

    if float(diff.max()) > atol or flips or abs(float(gate[0]) - threshold) > 1e-7:
        raise AssertionError(
            f"ONNX parity failed: max |score diff| = {diff.max():.3g}, "
            f"gate flips = {flips}, gate = {float(gate[0])} vs {threshold}"
        )
    return {
        "rows": int(len(X)),
        "max_abs_score_diff": float(diff.max()),
        "gate_flips": flips,
        "rows_with_missing": int(np.isnan(X).any(axis=1).sum()),
    }
