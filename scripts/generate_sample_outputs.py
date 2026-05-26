#!/usr/bin/env python3
"""Generate reproducible sample outputs for the Text-to-QCA tool.

The script intentionally uses only the Python standard library so reviewers can
reproduce outputs without installing packages.
"""

from __future__ import annotations

import csv
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT / "outputs"

FULL_IN = 0.55
CROSSOVER = 0.35
FULL_OUT = 0.15
CRISP_THRESHOLD = 0.50
MIN_CASES = 1
CONSISTENCY_CUTOFF = 0.75

SEMANTIC_BRIDGE = {
    "dissatisfaction": [
        "dissatisfaction",
        "anger",
        "frustration",
        "complaint",
        "disappointment",
        "不满",
        "投诉",
        "反映",
        "多次",
        "没有结果",
        "等待",
        "看不懂",
    ],
    "policy_demand": [
        "policy",
        "clarification",
        "adjustment",
        "implementation",
        "enforcement",
        "solution",
        "政策",
        "解释",
        "申请",
        "调整",
        "处理",
        "执法",
        "巡查",
        "方案",
        "说明",
    ],
    "coproduction_request": [
        "cooperate",
        "participate",
        "volunteer",
        "coordinate",
        "willingness",
        "配合",
        "愿意",
        "志愿者",
        "一起",
        "参加",
        "共同",
        "协商",
        "宣传",
        "培训",
    ],
    "responsiveness": [
        "clear",
        "concrete",
        "timely",
        "respectful",
        "response",
        "回复",
        "回应",
        "明确",
        "耐心",
        "及时",
        "安排",
        "告知",
        "步骤",
        "下一步",
    ],
}


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, object]], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fields})


def tokenize(text: str) -> Counter[str]:
    text = (text or "").lower()
    tokens: list[str] = []
    chinese = re.findall(r"[\u4e00-\u9fff]", text)
    tokens.extend(f"zh:{char}" for char in chinese)
    tokens.extend(f"zh2:{chinese[i]}{chinese[i + 1]}" for i in range(len(chinese) - 1))
    words = re.findall(r"[a-z0-9]+", text)
    tokens.extend(f"w:{word}" for word in words if len(word) > 1)
    tokens.extend(f"w2:{words[i]}_{words[i + 1]}" for i in range(len(words) - 1))
    for concept, terms in SEMANTIC_BRIDGE.items():
        for term in terms:
            if term.lower() in text:
                tokens.extend([f"sem:{concept}"] * 3)
    return Counter(tokens)


def cosine(left: Counter[str], right: Counter[str]) -> float:
    if not left or not right:
        return 0.0
    dot = sum(value * right.get(key, 0) for key, value in left.items())
    left_norm = math.sqrt(sum(value * value for value in left.values()))
    right_norm = math.sqrt(sum(value * value for value in right.values()))
    return dot / (left_norm * right_norm) if left_norm and right_norm else 0.0


def calibrate(score: float) -> float:
    if score <= FULL_OUT:
        return 0.0
    if score >= FULL_IN:
        return 1.0
    if score < CROSSOVER:
        return 0.5 * (score - FULL_OUT) / (CROSSOVER - FULL_OUT)
    return 0.5 + 0.5 * (score - CROSSOVER) / (FULL_IN - CROSSOVER)


def outcome_value(value: str) -> float:
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "y"}:
        return 1.0
    if text in {"0", "false", "no", "n", ""}:
        return 0.0
    try:
        return max(0.0, min(1.0, float(text)))
    except ValueError:
        return 0.0


def main() -> None:
    texts = read_csv(DATA / "demo_texts.csv")
    prototypes = [row for row in read_csv(DATA / "prototypes.csv") if row.get("type") == "condition"]
    proto_vectors = {row["condition_name"]: tokenize(row["prototype"]) for row in prototypes}

    score_rows: list[dict[str, object]] = []
    membership_rows: list[dict[str, object]] = []
    qca_rows: list[dict[str, object]] = []
    heatmap_rows: list[dict[str, object]] = []

    for case in texts:
        scores: dict[str, float] = {}
        memberships: dict[str, float] = {}
        crisp: dict[str, int] = {}
        text_vector = tokenize(case["text"])
        for proto in prototypes:
            name = proto["condition_name"]
            score = cosine(text_vector, proto_vectors[name])
            membership = calibrate(score)
            scores[name] = score
            memberships[name] = membership
            crisp[name] = 1 if membership >= CRISP_THRESHOLD else 0

        score_rows.append({"case_id": case["case_id"], "text": case["text"], **{k: f"{v:.4f}" for k, v in scores.items()}})
        membership_rows.append({"case_id": case["case_id"], **{k: f"{v:.4f}" for k, v in memberships.items()}})
        qca_rows.append({"case_id": case["case_id"], **{k: f"{memberships[k]:.4f}" for k in memberships}, "outcome": f"{outcome_value(case['outcome']):.4f}"})
        for name, membership in memberships.items():
            heatmap_rows.append({"case_id": case["case_id"], "condition": name, "membership": f"{membership:.4f}"})

    condition_names = [row["condition_name"] for row in prototypes]
    grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
    for qca in qca_rows:
        key = "".join("1" if float(qca[name]) >= CRISP_THRESHOLD else "0" for name in condition_names)
        grouped[key].append(qca)

    positives = sum(1 for row in qca_rows if float(row["outcome"]) >= 0.5)
    truth_rows: list[dict[str, object]] = []
    plot_rows: list[dict[str, object]] = []
    for key, rows in sorted(grouped.items()):
        positive_count = sum(1 for row in rows if float(row["outcome"]) >= 0.5)
        consistency = positive_count / len(rows) if rows else 0.0
        coverage = positive_count / positives if positives else 0.0
        row = {
            "configuration": key,
            **{condition_names[i]: key[i] for i in range(len(condition_names))},
            "n_cases": len(rows),
            "case_ids": ";".join(str(row["case_id"]) for row in rows),
            "outcome_value": 1 if consistency >= CONSISTENCY_CUTOFF else 0,
            "consistency": f"{consistency:.4f}",
            "coverage": f"{coverage:.4f}",
            "status": "solution" if len(rows) >= MIN_CASES and consistency >= CONSISTENCY_CUTOFF else ("contradictory" if 0 < consistency < 1 else "weak"),
        }
        truth_rows.append(row)
        plot_rows.append({"configuration": key, "consistency": f"{consistency:.4f}", "coverage": f"{coverage:.4f}", "n_cases": len(rows)})

    solution_rows = [row for row in truth_rows if row["status"] == "solution"]

    write_csv(OUT / "similarity_scores.csv", score_rows, ["case_id", "text", *condition_names])
    write_csv(OUT / "calibrated_membership.csv", membership_rows, ["case_id", *condition_names])
    write_csv(OUT / "qca_ready_dataset.csv", qca_rows, ["case_id", *condition_names, "outcome"])
    write_csv(OUT / "truth_table.csv", truth_rows, ["configuration", *condition_names, "n_cases", "case_ids", "outcome_value", "consistency", "coverage", "status"])
    write_csv(OUT / "solution_configurations.csv", solution_rows, ["configuration", *condition_names, "n_cases", "case_ids", "outcome_value", "consistency", "coverage", "status"])
    write_csv(OUT / "membership_heatmap.csv", heatmap_rows, ["case_id", "condition", "membership"])
    write_csv(OUT / "consistency_coverage_plot.csv", plot_rows, ["configuration", "consistency", "coverage", "n_cases"])
    print(f"Wrote sample outputs to {OUT}")


if __name__ == "__main__":
    main()
