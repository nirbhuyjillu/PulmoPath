"""Create an article-pattern synthetic PEF panel and export a tanh neural net.

Repeated-measure structure, article PM2.5 bounds, approximate panel size, and
reported effect-size range are patterned on Jacobson et al. (PMID 22683314).
The published abstract does not provide patient-level rows here. Every generated
row is simulated, not an original measurement or a clinically validated model.
"""
from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path
from typing import Any

SEED = 20261023
SUBJECT_COUNT = 309
OBSERVATION_COUNT = 19_115
MAX_OBSERVATIONS_PER_SUBJECT = 67
TRAIN_FRACTION = 0.8
DEFAULT_HYPERPARAMETERS = {
    "hidden_size": 8,
    "epochs": 335,
    "learning_rate": 0.025
}
HYPERPARAMETER_GRID = [
    {"hidden_size": hidden, "epochs": epochs, "learning_rate": rate, "dropout_rate": dropout}
    for hidden in (2, 4)
    for epochs in (4, 10)
    for rate in (0.01, 0.03)
    for dropout in (0.20, 0.40)
]
HPO_VALIDATION_FRACTION = 0.2
HPO_MAX_TRAIN_ROWS_PER_SUBJECT = 4
HPO_MAX_VALIDATION_ROWS_PER_SUBJECT = 8

ARTICLE = {
    "citation": "Jacobson et al., Environmental Research (2012), PMID 22683314",
    "url": "https://pubmed.ncbi.nlm.nih.gov/22683314/",
    "subjects": SUBJECT_COUNT,
    "observations": OBSERVATION_COUNT,
    "max_observations_per_subject": MAX_OBSERVATIONS_PER_SUBJECT,
    "pm25_min": 6.39,
    "pm25_max": 99.91,
    "reported_overall_pef_reduction_l_min_per_10": [0.26, 0.38],
    "reported_non_asthma_reduction_l_min_per_10": [0.38, 0.53],
}

# Not given by the paper abstract: explicit simulation assumptions.
ASSUMPTIONS = {
    "daily_exposure_generator": "AR(1) regional concentration with smooth seasonal cycle and random excursions; clipped to reported range",
    "wind_generator": "AR(1) 10 m wind speed with range 0-55 km/h; distribution is a simulation assumption",
    "wind_pm25_association": "Assumed weak inverse association: stagnant conditions permit local accumulation; not an effect estimate from the cited PEF article",
    "wind_pm25_coefficient_per_kmh": -0.12,
    "wind_speed_min_kmh": 0.0,
    "wind_speed_max_kmh": 55.0,
    "pm25_lag_weights": [0.5, 0.3, 0.2],
    "population_reference_pm25": 25.0,
    "mean_pef_baseline_l_min": 375.0,
    "sd_pef_baseline_l_min": 22.0,
    "within_subject_residual_sd_l_min": 8.0,
    "within_subject_residual_ar1": 0.45,
    "individual_effect_mean_l_min_per_10": 0.32,
    "individual_effect_sd_l_min_per_10": 0.10,
    "effect_range_l_min_per_10": [0.26, 0.38],
    "pef_clipping_range_l_min": [250.0, 550.0],
    "asthma_subgroups": "Not generated: the article reports no significant effect in its asthma subgroup, and group sample counts/distributions are not specified here.",
}


def _generate_daily_weather(rng: random.Random) -> tuple[list[float], list[float]]:
    """Generate synthetic PM2.5 and wind; their weak association is an assumption."""
    pm25_values: list[float] = []
    wind_values: list[float] = []
    pm_state = 25.0
    wind_state = 14.0
    for day in range(MAX_OBSERVATIONS_PER_SUBJECT):
        seasonal = 12.0 * math.sin(2.0 * math.pi * day / MAX_OBSERVATIONS_PER_SUBJECT)
        wind_state = 0.72 * wind_state + 0.28 * (14.0 + 5.0 * math.cos(
            2.0 * math.pi * day / MAX_OBSERVATIONS_PER_SUBJECT
        )) + rng.gauss(0.0, 7.0)
        wind = max(ASSUMPTIONS["wind_speed_min_kmh"], min(
            ASSUMPTIONS["wind_speed_max_kmh"], wind_state
        ))
        wind_values.append(wind)
        dispersion = ASSUMPTIONS["wind_pm25_coefficient_per_kmh"] * (wind - 14.0)
        pm_state = (0.82 * pm_state + 0.18 * (25.0 + seasonal)
                    + rng.gauss(0.0, 12.0) + dispersion)
        pm25_values.append(max(ARTICLE["pm25_min"], min(ARTICLE["pm25_max"], pm_state)))
    # Represent the observed endpoints without claiming a particular frequency.
    # Consecutive extrema ensure the lag-weighted exposure feature also reaches them.
    pm25_values[0:3] = [ARTICLE["pm25_min"]] * 3
    high_start = MAX_OBSERVATIONS_PER_SUBJECT // 2
    pm25_values[high_start:high_start + 3] = [ARTICLE["pm25_max"]] * 3
    wind_values[0:3] = [ASSUMPTIONS["wind_speed_min_kmh"]] * 3
    wind_values[high_start:high_start + 3] = [ASSUMPTIONS["wind_speed_max_kmh"]] * 3
    return pm25_values, wind_values


def generate_dataset() -> list[dict[str, float | int | bool]]:
    """Generate repeated rows per synthetic child, totaling exactly 19,115."""
    rng = random.Random(SEED)
    daily_pm25, daily_wind = _generate_daily_weather(rng)
    # 266*62 + 43*61 = 19,115; each child has no more than the reported 67 measures.
    counts = [62] * 266 + [61] * 43
    rng.shuffle(counts)
    rows: list[dict[str, float | int | bool]] = []
    pef_min, pef_max = ASSUMPTIONS["pef_clipping_range_l_min"]
    effect_min, effect_max = ASSUMPTIONS["effect_range_l_min_per_10"]

    for subject_id, count in enumerate(counts):
        baseline = max(319.0, min(430.0, rng.gauss(
            ASSUMPTIONS["mean_pef_baseline_l_min"], ASSUMPTIONS["sd_pef_baseline_l_min"]
        )))
        individual_effect = max(effect_min, min(effect_max, rng.gauss(
            ASSUMPTIONS["individual_effect_mean_l_min_per_10"],
            ASSUMPTIONS["individual_effect_sd_l_min_per_10"],
        )))
        days = sorted(rng.sample(range(MAX_OBSERVATIONS_PER_SUBJECT), count))
        residual = 0.0
        for day in days:
            lagged_exposure = (
                0.5 * daily_pm25[day]
                + 0.3 * daily_pm25[max(0, day - 1)]
                + 0.2 * daily_pm25[max(0, day - 2)]
            )
            lagged_wind = (
                0.5 * daily_wind[day]
                + 0.3 * daily_wind[max(0, day - 1)]
                + 0.2 * daily_wind[max(0, day - 2)]
            )
            residual = (
                ASSUMPTIONS["within_subject_residual_ar1"] * residual
                + rng.gauss(0.0, ASSUMPTIONS["within_subject_residual_sd_l_min"])
            )
            pef = baseline - individual_effect * (
                lagged_exposure - ASSUMPTIONS["population_reference_pm25"]
            ) / 10.0 + residual
            rows.append({
                "subject_id": subject_id,
                "day": day,
                "pm25": lagged_exposure,
                "wind_speed": lagged_wind,
                "pef": max(pef_min, min(pef_max, pef)),
                "synthetic": True,
            })
    if len(rows) != OBSERVATION_COUNT:
        raise ValueError(f"Expected {OBSERVATION_COUNT} rows; generated {len(rows)}.")
    return rows


def _normalize_pm25(pm25: float, x_min: float, x_max: float) -> float:
    return 2.0 * (pm25 - x_min) / (x_max - x_min) - 1.0


def _normalize_wind(wind_speed: float, wind_min: float, wind_max: float) -> float:
    return 2.0 * (wind_speed - wind_min) / (wind_max - wind_min) - 1.0


def _normalize_y(pef: float, y_min: float, y_max: float) -> float:
    return 2.0 * (pef - y_min) / (y_max - y_min) - 1.0


def _new_network(rng: random.Random, hidden_size: int) -> dict[str, Any]:
    return {
        "hidden_weights": [[rng.uniform(-0.5, 0.5), rng.uniform(-0.5, 0.5)]
                           for _ in range(hidden_size)],
        "hidden_biases": [rng.uniform(-0.1, 0.1) for _ in range(hidden_size)],
        "output_weights": [rng.uniform(-0.2, 0.2) for _ in range(hidden_size)],
        "output_bias": 0.0,
    }


def _forward(network: dict[str, Any], features: list[float],
             dropout_scales: list[float] | None = None) -> tuple[list[float], float]:
    activations = [
        math.tanh(sum(weight * value for weight, value in
                      zip(network["hidden_weights"][i], features))
                  + network["hidden_biases"][i])
        for i in range(len(network["hidden_weights"]))
    ]
    scales = dropout_scales if dropout_scales is not None else [1.0] * len(activations)
    hidden = [activation * scale for activation, scale in zip(activations, scales)]
    output = math.tanh(sum(w * activation for w, activation in
                           zip(network["output_weights"], hidden)) + network["output_bias"])
    return activations, output


def _features(pm25: float, wind_speed: float, normalization: dict[str, float]) -> list[float]:
    return [
        _normalize_pm25(pm25, normalization["pm25_min"], normalization["pm25_max"]),
        _normalize_wind(wind_speed, normalization["wind_speed_min"],
                        normalization["wind_speed_max"]),
    ]


def _predict_pef(network: dict[str, Any], pm25: float, wind_speed: float,
                 normalization: dict[str, float]) -> float:
    normalized_output = _forward(network, _features(pm25, wind_speed, normalization))[1]
    y_min, y_max = normalization["pef_min"], normalization["pef_max"]
    return y_min + (normalized_output + 1.0) * (y_max - y_min) / 2.0


def train_network(
    rows: list[dict[str, Any]],
    normalization: dict[str, float],
    hyperparameters: dict[str, float | int],
    seed_offset: int = 0,
    validation_rows: list[dict[str, Any]] | None = None,
    record_history: bool = False,
) -> tuple[dict[str, Any], list[dict[str, float]]]:
    """Fit tanh MLP by online SGD; dropout is applied only during training."""
    hidden_size = int(hyperparameters["hidden_size"])
    epochs = int(hyperparameters["epochs"])
    learning_rate = float(hyperparameters["learning_rate"])
    dropout_rate = float(hyperparameters["dropout_rate"])
    rng = random.Random(SEED + 1 + seed_offset)
    network = _new_network(rng, hidden_size)
    normalized = [(_features(float(row["pm25"]), float(row["wind_speed"]), normalization),
                   _normalize_y(float(row["pef"]), normalization["pef_min"],
                                normalization["pef_max"])) for row in rows]

    history: list[dict[str, float]] = []
    for epoch in range(epochs):
        rng.shuffle(normalized)
        for features, target in normalized:
            masks = [1.0 / (1.0 - dropout_rate) if rng.random() >= dropout_rate else 0.0
                     for _ in range(hidden_size)]
            activations, prediction = _forward(network, features, masks)
            output_delta = (prediction - target) * (1.0 - prediction * prediction)
            old_output_weights = network["output_weights"][:]
            hidden_used = [a * mask for a, mask in zip(activations, masks)]
            for index in range(hidden_size):
                network["output_weights"][index] -= learning_rate * output_delta * hidden_used[index]
            network["output_bias"] -= learning_rate * output_delta
            for index in range(hidden_size):
                hidden_delta = (output_delta * old_output_weights[index] * masks[index]
                                * (1.0 - activations[index] ** 2))
                for feature_index, feature in enumerate(features):
                    network["hidden_weights"][index][feature_index] -= (
                        learning_rate * hidden_delta * feature
                    )
                network["hidden_biases"][index] -= learning_rate * hidden_delta
        if record_history:
            train_metrics = _metrics(network, rows, normalization)
            val_metrics = _metrics(network, validation_rows or [], normalization) if validation_rows else {}
            history_row: dict[str, float] = {
                "epoch": float(epoch + 1),
                "training_mse": train_metrics["mse_l_min_squared_synthetic_only"],
                "training_r_squared": train_metrics["r_squared_synthetic_only"],
            }
            if val_metrics:
                history_row["validation_mse"] = val_metrics["mse_l_min_squared_synthetic_only"]
                history_row["validation_r_squared"] = val_metrics["r_squared_synthetic_only"]
            history.append(history_row)
    return network, history


def _metrics(network: dict[str, Any], rows: list[dict[str, Any]],
             normalization: dict[str, float]) -> dict[str, float]:
    errors = [float(row["pef"]) - _predict_pef(
        network, float(row["pm25"]), float(row["wind_speed"]), normalization
    ) for row in rows]
    mean_actual = sum(float(row["pef"]) for row in rows) / len(rows)
    ss_total = sum((float(row["pef"]) - mean_actual) ** 2 for row in rows)
    ss_residual = sum(error * error for error in errors)
    return {
        "mae_l_min_synthetic_only": sum(abs(error) for error in errors) / len(errors),
        "mse_l_min_squared_synthetic_only": ss_residual / len(errors),
        "rmse_l_min_synthetic_only": math.sqrt(ss_residual / len(errors)),
        "r_squared_synthetic_only": 1.0 - ss_residual / ss_total if ss_total else 0.0,
    }


def _sample_subject_rows(
    rows: list[dict[str, Any]], subject_ids: set[int], limit_per_subject: int, seed: int
) -> list[dict[str, Any]]:
    """Subsample rows deterministically while preserving subject-level separation."""
    rng = random.Random(seed)
    by_subject: dict[int, list[dict[str, Any]]] = {}
    for row in rows:
        subject_id = int(row["subject_id"])
        if subject_id in subject_ids:
            by_subject.setdefault(subject_id, []).append(row)
    sample: list[dict[str, Any]] = []
    for subject_id in sorted(by_subject):
        subject_rows = by_subject[subject_id]
        if len(subject_rows) > limit_per_subject:
            subject_rows = rng.sample(subject_rows, limit_per_subject)
        sample.extend(subject_rows)
    return sample


def optimize_hyperparameters(
    rows: list[dict[str, Any]], training_subject_ids: set[int],
    normalization: dict[str, float],
) -> tuple[dict[str, float | int], list[dict[str, Any]]]:
    """Select using inner validation subjects; the final test subjects stay untouched."""
    shuffled_ids = sorted(training_subject_ids)
    random.Random(SEED + 3).shuffle(shuffled_ids)
    validation_count = max(1, round(len(shuffled_ids) * HPO_VALIDATION_FRACTION))
    validation_ids = set(shuffled_ids[:validation_count])
    inner_training_ids = set(shuffled_ids[validation_count:])
    inner_training_rows = _sample_subject_rows(
        rows, inner_training_ids, HPO_MAX_TRAIN_ROWS_PER_SUBJECT, SEED + 4
    )
    validation_rows = _sample_subject_rows(
        rows, validation_ids, HPO_MAX_VALIDATION_ROWS_PER_SUBJECT, SEED + 5
    )

    results: list[dict[str, Any]] = []
    for index, candidate in enumerate(HYPERPARAMETER_GRID):
        candidate_model, _ = train_network(
            inner_training_rows, normalization, candidate, seed_offset=100 + index
        )
        candidate_metrics = _metrics(candidate_model, validation_rows, normalization)
        results.append({
            "hyperparameters": candidate.copy(),
            "validation_subjects": len(validation_ids),
            "validation_rows": len(validation_rows),
            "validation_metrics": candidate_metrics,
        })

    results.sort(key=lambda result: (
        result["validation_metrics"]["mae_l_min_synthetic_only"],
        result["validation_metrics"]["rmse_l_min_synthetic_only"],
    ))
    selected = results[0]["hyperparameters"]
    return selected, results


def train_export(output_path: Path) -> dict[str, Any]:
    rows = generate_dataset()
    subject_ids = list(range(SUBJECT_COUNT))
    random.Random(SEED + 2).shuffle(subject_ids)
    train_subject_count = int(SUBJECT_COUNT * TRAIN_FRACTION)
    training_ids = set(subject_ids[:train_subject_count])
    training_rows = [row for row in rows if row["subject_id"] in training_ids]
    testing_rows = [row for row in rows if row["subject_id"] not in training_ids]

    y_min, y_max = ASSUMPTIONS["pef_clipping_range_l_min"]
    normalization = {
        "pm25_min": ARTICLE["pm25_min"],
        "pm25_max": ARTICLE["pm25_max"],
        "wind_speed_min": ASSUMPTIONS["wind_speed_min_kmh"],
        "wind_speed_max": ASSUMPTIONS["wind_speed_max_kmh"],
        "pef_min": y_min,
        "pef_max": y_max,
    }
    selected_hyperparameters, hpo_results = optimize_hyperparameters(
        rows, training_ids, normalization
    )
    shuffled_training_ids = sorted(training_ids)
    random.Random(SEED + 3).shuffle(shuffled_training_ids)
    history_validation_count = max(1, round(len(shuffled_training_ids) * HPO_VALIDATION_FRACTION))
    history_validation_ids = set(shuffled_training_ids[:history_validation_count])
    history_training_ids = set(shuffled_training_ids[history_validation_count:])
    history_training_rows = [row for row in rows if row["subject_id"] in history_training_ids]
    history_validation_rows = [row for row in rows if row["subject_id"] in history_validation_ids]
    _, epoch_history = train_network(
        history_training_rows, normalization, selected_hyperparameters,
        seed_offset=800, validation_rows=history_validation_rows, record_history=True,
    )
    # Refit selected settings on every outer-training subject; the final test set
    # remains untouched, and the chart remains from the separate inner split.
    network, _ = train_network(
        training_rows, normalization, selected_hyperparameters, seed_offset=0
    )
    artifact: dict[str, Any] = {
        "schema_version": 1,
        "model_type": "two-input tanh multilayer perceptron",
        "architecture": {"inputs": 2, "input_features": ["pm25", "wind_speed_kmh"],
                 "hidden": int(selected_hyperparameters["hidden_size"]), "outputs": 1,
                         "hidden_activation": "tanh", "output_activation": "tanh",
                 "dropout_rate": float(selected_hyperparameters["dropout_rate"])},
        "normalization": normalization,
        "weights": network,
        "training": {
            "synthetic": True,
            "seed": SEED,
            "generated_rows": len(rows),
            "subjects": SUBJECT_COUNT,
            "training_subjects": len(training_ids),
            "testing_subjects": SUBJECT_COUNT - len(training_ids),
            "training_rows": len(training_rows),
            "testing_rows": len(testing_rows),
            "hyperparameter_selection": {
                "method": "deterministic grid search; validation split by subject_id within outer training subjects",
                "selection_metric": "lowest validation MAE; RMSE tie-breaker",
                "outer_test_used_for_selection": False,
                "candidate_count": len(hpo_results),
                "validation_subjects": hpo_results[0]["validation_subjects"],
                "validation_rows": hpo_results[0]["validation_rows"],
                "selected": selected_hyperparameters,
                "ranked_results": hpo_results,
            },
            "epoch_history": epoch_history,
            "epoch_history_note": "Per-epoch train/inner-validation curves from a subject-level split. The final outer test subjects are not charted or used for tuning.",
            **selected_hyperparameters,
            "split_unit": "subject_id; no synthetic subject appears in both train and test",
            "training_metrics": _metrics(network, training_rows, normalization),
            "testing_metrics": _metrics(network, testing_rows, normalization),
        },
        "source": {
            "primary_article": ARTICLE,
            "additional_references": [
                "https://pubmed.ncbi.nlm.nih.gov/21392385/",
                "https://pubmed.ncbi.nlm.nih.gov/33096665/",
            ],
            "simulation_assumptions": ASSUMPTIONS,
            "limitations": [
                "Rows are synthetic and do not reproduce or disclose the source study's individual observations.",
                "The source describes a panel and effect estimates; the exposure time series, subject baselines, residuals, lag weights, and effect distribution are simulation assumptions.",
                "Holdout metrics evaluate only the artificial simulated panel, not predictive performance in real patients.",
                "Not for clinical decisions, treatment changes, or travel recommendations.",
            ],
        },
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    return artifact


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path,
                        default=Path(__file__).with_name("regression-model.json"),
                        help="path for browser-loadable trained weights JSON")
    args = parser.parse_args()
    artifact = train_export(args.output)
    training = artifact["training"]
    print(f"Wrote {args.output}")
    print(f"Synthetic panel: {training['generated_rows']} rows / {training['subjects']} subjects")
    print(f"Grouped split: {training['training_subjects']} train subjects, {training['testing_subjects']} test subjects")
    print("Selected hyperparameters:", json.dumps(training["hyperparameter_selection"]["selected"], sort_keys=True))
    print("Synthetic-only holdout metrics:", json.dumps(training["testing_metrics"], sort_keys=True))
    print("Warning: these scores are not clinical validation.")


if __name__ == "__main__":
    main()
