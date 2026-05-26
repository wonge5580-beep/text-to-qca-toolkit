# Text-to-QCA Toolkit for Government–Citizen Interaction Analysis

Live demo: https://wonge5580-beep.github.io/text-to-qca-toolkit/

This repository completes Task 2 of the take-home assessment. It provides a
browser-based toolkit that converts raw text into prototype-based condition
scores, calibrates those scores into QCA set memberships, and produces
QCA-ready outputs.

The tool is designed for digital governance research, especially analysis of
citizen messages, government replies, public consultation comments, and policy
feedback. It does not require an API key, backend server, database, or manual
code editing for the main workflow.

## Quick Start

### Option 1: Live Demo

Open the hosted demo:

https://wonge5580-beep.github.io/text-to-qca-toolkit/

Click `Load demo data`, then inspect the score table, calibrated membership
table, truth table, solution configurations, heatmap, and
consistency-coverage plot.

### Option 2: Local Run

Open `index.html` directly in a browser.

If the browser blocks local file behavior, serve the folder locally:

```bash
python3 -m http.server 8765
```

Then open:

```text
http://localhost:8765/index.html
```

## Repository Contents

- `index.html`, `styles.css`, `app.js`: static browser application.
- `data/demo_texts.csv`: demo Chinese government-citizen interaction data.
- `data/prototypes.csv`: conceptual prototype descriptions.
- `outputs/`: sample scoring, calibration, QCA, truth-table, solution, and
  figure-data outputs.
- `scripts/generate_sample_outputs.py`: reproducible output generator using
  only the Python standard library.
- `TECHNICAL_NOTE.md`: methodological note covering interpretation,
  assumptions, limitations, and future improvements.

## Input Data

The text dataset should be a CSV file with one row per case. It should include:

- a case identifier column;
- a text column;
- optionally, an outcome column coded as `0/1`, `true/false`, `yes/no`, or a
  numeric fuzzy-set membership value.

The prototype dataset should be a CSV file with these columns:

- `condition_name`
- `prototype`
- `type`

Use `type=condition` for QCA causal conditions. Use `type=outcome` for
conceptual outcome prototypes.

## Main Workflow

1. Upload or load a text dataset.
2. Select the case ID, text, and outcome columns.
3. Upload or load conceptual prototypes.
4. Score each text against each prototype.
5. Calibrate raw similarity scores into fuzzy-set or crisp-set membership.
6. Generate a QCA-ready dataset.
7. Produce a truth table with consistency and coverage.
8. Identify solution, contradictory, and weak configurations.
9. Export tables for reporting or further analysis.

## Reproduce Sample Outputs

From the project folder, run:

```bash
python3 scripts/generate_sample_outputs.py
```

The script reads `data/demo_texts.csv` and `data/prototypes.csv`, then writes:

- `outputs/similarity_scores.csv`
- `outputs/calibrated_membership.csv`
- `outputs/qca_ready_dataset.csv`
- `outputs/truth_table.csv`
- `outputs/solution_configurations.csv`
- `outputs/membership_heatmap.csv`
- `outputs/consistency_coverage_plot.csv`

## Method Summary

The tool uses transparent lexical scoring rather than a hidden model. It
constructs character and word n-gram features for Chinese and English text, adds
a small bilingual concept bridge for the demo concepts, and calculates cosine
similarity between each text and each prototype.

Scores are calibrated with visible user-adjustable anchors:

- full membership: default `0.55`
- crossover: default `0.35`
- full non-membership: default `0.15`
- crisp threshold: default `0.50`

For QCA, each calibrated condition becomes a set-membership column. The truth
table groups cases by crisp condition membership and reports case count,
outcome share, consistency, and coverage.

## Hosting

The application is fully static. It can be hosted on GitHub Pages, Netlify,
Vercel, or any static file host.
