"""ONNX export: the gate graph, NaN handling, and parity with scikit-learn.

Synthetic data only, so these run without the confidential CSV.
"""

from __future__ import annotations

import numpy as np
import onnx
import onnxruntime as ort
import pytest
from sklearn.ensemble import HistGradientBoostingRegressor

from invest_model.config import FEATURES, ONNX_INPUT
from invest_model.export import build_onnx, check_parity


@pytest.fixture(scope="module")
def fitted() -> tuple[HistGradientBoostingRegressor, np.ndarray]:
    rng = np.random.default_rng(0)
    n = 400
    X = np.column_stack(
        [rng.integers(1, 6, n).astype(float) for _ in range(6)]
        + [rng.choice([0.0, 5e4, 2e5, 1e6, 8e6], n)]
    )
    # Knock out ~15% of cells, as unrated criteria / blank funding do in the real data.
    X[rng.random(X.shape) < 0.15] = np.nan
    y = (np.nansum(X[:, :6], axis=1) + rng.normal(0, 2, n) > 19).astype(float)
    model = HistGradientBoostingRegressor(max_iter=60, random_state=0).fit(X, y)
    return model, X


def _run(onx: onnx.ModelProto, X: np.ndarray):
    session = ort.InferenceSession(onx.SerializeToString(), providers=["CPUExecutionProvider"])
    return session.run(None, {ONNX_INPUT: X.astype(np.float32)})


def test_graph_contract(fitted):
    model, _ = fitted
    onx = build_onnx(model, 0.4)
    assert [i.name for i in onx.graph.input] == [ONNX_INPUT]
    assert onx.graph.input[0].type.tensor_type.shape.dim[1].dim_value == len(FEATURES)
    assert [o.name for o in onx.graph.output] == ["score", "invest", "threshold"]
    domains = [o.domain for o in onx.opset_import]
    assert len(domains) == len(set(domains)), "duplicate opset domains"
    props = {p.key: p.value for p in onx.metadata_props}
    assert props["features"] == ",".join(FEATURES)


def test_parity_including_missing_values(fitted):
    model, X = fitted
    onx = build_onnx(model, 0.4)
    report = check_parity(model, 0.4, onx, X)
    assert report["rows_with_missing"] > 0
    assert report["max_abs_score_diff"] < 1e-5
    assert report["gate_flips"] == 0


def test_gate_semantics(fitted):
    model, X = fitted
    threshold = 0.37
    score, invest, gate = _run(build_onnx(model, threshold), X)
    assert score.shape == (len(X), 1) and invest.shape == (len(X), 1)
    assert invest.dtype == np.int64
    assert float(gate[0]) == pytest.approx(threshold)
    assert np.all((score >= 0) & (score <= 1))
    np.testing.assert_array_equal(invest[:, 0], (score[:, 0] >= np.float32(threshold)).astype(np.int64))


def test_all_missing_row_still_scores(fitted):
    model, _ = fitted
    score, invest, _ = _run(build_onnx(model, 0.4), np.full((1, len(FEATURES)), np.nan))
    assert np.isfinite(score).all()
    assert invest[0, 0] in (0, 1)


@pytest.mark.parametrize("bad", [0.0, 1.0, -0.1, 1.5])
def test_rejects_degenerate_threshold(fitted, bad):
    model, _ = fitted
    with pytest.raises(ValueError):
        build_onnx(model, bad)
