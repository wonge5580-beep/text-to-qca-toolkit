const demoTextCsv = `case_id,text,outcome
1,我已经多次反映小区垃圾分类设施不足，希望政府尽快处理。,1
2,这个政策解释不清楚，居民不知道应该如何申请。,0
3,我们愿意配合街道办开展社区宣传活动，也希望政府提供材料。,1
4,工作人员回复很耐心，明确说明了办理步骤和截止日期。,1
5,投诉很多次都没有结果，热线只是让我们继续等待。,0
6,希望调整停车收费政策，给老旧小区居民一个过渡方案。,1
7,我不反对新规，但是申请入口和材料要求完全看不懂。,0
8,社区志愿者可以和居委会一起组织垃圾分类培训。,1
9,政府回复只说按规定办理，没有说明下一步找谁处理。,0
10,感谢街道及时回应，已经安排人员现场查看并告知处理时间。,1
11,居民对噪音问题非常不满，希望执法部门加强夜间巡查。,1
12,我们愿意参加协商会，共同制定更合理的公共空间管理办法。,1`;

const demoPrototypeCsv = `condition_name,prototype,type
dissatisfaction,The citizen expresses dissatisfaction anger frustration complaint or disappointment about public service,condition
policy_demand,The citizen asks for policy clarification adjustment implementation enforcement or a concrete government solution,condition
coproduction_request,The citizen shows willingness to cooperate participate volunteer coordinate or work with government,condition
responsiveness,The government provides a clear concrete timely respectful response with next steps,outcome`;

let state = {
  textRows: [],
  prototypeRows: [],
  results: null,
  activeTab: "scores",
  overrides: {},
};

const semanticBridge = {
  dissatisfaction: [
    "dissatisfaction", "anger", "frustration", "complaint", "disappointment",
    "不满", "投诉", "反映", "多次", "没有结果", "等待", "看不懂",
  ],
  policy_demand: [
    "policy", "clarification", "adjustment", "implementation", "enforcement", "solution",
    "政策", "解释", "申请", "调整", "处理", "执法", "巡查", "方案", "说明",
  ],
  coproduction_request: [
    "cooperate", "participate", "volunteer", "coordinate", "willingness",
    "配合", "愿意", "志愿者", "一起", "参加", "共同", "协商", "宣传", "培训",
  ],
  responsiveness: [
    "clear", "concrete", "timely", "respectful", "response",
    "回复", "回应", "明确", "耐心", "及时", "安排", "告知", "步骤", "下一步",
  ],
};

const el = (id) => document.getElementById(id);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = values[index] ?? "";
    });
    return item;
  });
}

function toCsv(rows) {
  if (!rows || rows.length === 0) return "";
  const fields = Object.keys(rows[0]);
  const quote = (value) => {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [fields.join(","), ...rows.map((row) => fields.map((field) => quote(row[field])).join(","))].join("\n");
}

function downloadCsv(name, rows) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadText(name, text, type = "text/markdown;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function tokenize(text) {
  const normalized = String(text || "").toLowerCase();
  const tokens = [];
  const chinese = normalized.match(/[\u4e00-\u9fff]/g) || [];
  chinese.forEach((char) => tokens.push(`zh:${char}`));
  for (let i = 0; i < chinese.length - 1; i += 1) tokens.push(`zh2:${chinese[i]}${chinese[i + 1]}`);
  const words = normalized.match(/[a-z0-9]+/g) || [];
  words.filter((word) => word.length > 1).forEach((word) => tokens.push(`w:${word}`));
  for (let i = 0; i < words.length - 1; i += 1) tokens.push(`w2:${words[i]}_${words[i + 1]}`);
  Object.entries(semanticBridge).forEach(([concept, terms]) => {
    terms.forEach((term) => {
      if (normalized.includes(term.toLowerCase())) {
        tokens.push(`sem:${concept}`, `sem:${concept}`, `sem:${concept}`);
      }
    });
  });
  return tokens.reduce((map, token) => {
    map[token] = (map[token] || 0) + 1;
    return map;
  }, {});
}

function cosine(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length === 0 || rightKeys.length === 0) return 0;
  const dot = leftKeys.reduce((sum, key) => sum + left[key] * (right[key] || 0), 0);
  const leftNorm = Math.sqrt(leftKeys.reduce((sum, key) => sum + left[key] ** 2, 0));
  const rightNorm = Math.sqrt(rightKeys.reduce((sum, key) => sum + right[key] ** 2, 0));
  return leftNorm && rightNorm ? dot / (leftNorm * rightNorm) : 0;
}

function overlapTerms(left, right) {
  return Object.keys(left)
    .filter((key) => right[key])
    .sort((a, b) => left[b] * right[b] - left[a] * right[a])
    .slice(0, 8)
    .map((key) => key.replace(/^zh2?:|^w2?:/g, "").replaceAll("_", " "))
    .join("; ");
}

function fuzzyCalibrate(score, fullIn, crossOver, fullOut) {
  if (score <= fullOut) return 0;
  if (score >= fullIn) return 1;
  if (score < crossOver) return 0.5 * ((score - fullOut) / (crossOver - fullOut));
  return 0.5 + 0.5 * ((score - crossOver) / (fullIn - crossOver));
}

function parseOutcome(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(text)) return 1;
  if (["0", "false", "no", "n", ""].includes(text)) return 0;
  const number = Number(text);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

function format(number) {
  return Number(number).toFixed(4);
}

function columnsOf(rows) {
  return rows.length ? Object.keys(rows[0]) : [];
}

function fillSelect(select, options, preferred) {
  select.innerHTML = "";
  options.forEach((option) => {
    const node = document.createElement("option");
    node.value = option;
    node.textContent = option || "(none)";
    select.appendChild(node);
  });
  if (options.includes(preferred)) select.value = preferred;
}

function updateColumnControls() {
  const columns = columnsOf(state.textRows);
  fillSelect(el("textColumn"), columns, columns.find((name) => /text|message|comment/i.test(name)) || columns[0]);
  fillSelect(el("caseColumn"), columns, columns.find((name) => /case|id/i.test(name)) || columns[0]);
  fillSelect(el("outcomeColumn"), ["", ...columns], columns.find((name) => /outcome|result|y/i.test(name)) || "");
}

function readSettings() {
  const settings = {
    mode: el("calibrationMode").value,
    fullIn: Number(el("fullIn").value),
    crossOver: Number(el("crossOver").value),
    fullOut: Number(el("fullOut").value),
    crispThreshold: Number(el("crispThreshold").value),
    minCases: Number(el("minCases").value),
    consistencyCutoff: Number(el("consistencyCutoff").value),
    sensitivityThresholds: parseThresholds(el("sensitivityThresholds").value),
  };
  if (!(settings.fullOut < settings.crossOver && settings.crossOver < settings.fullIn)) {
    throw new Error("Calibration anchors must satisfy full non-membership < crossover < full membership.");
  }
  return settings;
}

function parseThresholds(value) {
  const parsed = String(value || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item >= 0 && item <= 1);
  return [...new Set(parsed)].sort((a, b) => a - b);
}

function buildQcaOutputs(qcaRows, conditionNames, settings, hasOutcome, threshold = settings.crispThreshold) {
  const positiveCases = qcaRows.filter((row) => parseOutcome(row.outcome) >= 0.5).length;
  const grouped = {};
  qcaRows.forEach((row) => {
    const configuration = conditionNames.map((name) => (Number(row[name]) >= threshold ? "1" : "0")).join("");
    grouped[configuration] ||= [];
    grouped[configuration].push(row);
  });

  const truthRows = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([configuration, rows]) => {
    const positives = hasOutcome ? rows.filter((row) => parseOutcome(row.outcome) >= 0.5).length : 0;
    const consistency = hasOutcome ? positives / rows.length : 0;
    const coverage = hasOutcome && positiveCases ? positives / positiveCases : 0;
    const status = !hasOutcome
      ? "no outcome"
      : (rows.length >= settings.minCases && consistency >= settings.consistencyCutoff ? "solution" : (consistency > 0 && consistency < 1 ? "contradictory" : "weak"));
    return {
      configuration,
      ...Object.fromEntries(conditionNames.map((name, i) => [name, configuration[i]])),
      n_cases: rows.length,
      case_ids: rows.map((row) => row.case_id).join(";"),
      outcome_value: hasOutcome ? (consistency >= settings.consistencyCutoff ? 1 : 0) : "",
      consistency: hasOutcome ? format(consistency) : "",
      coverage: hasOutcome ? format(coverage) : "",
      status,
    };
  });

  return {
    truthRows,
    solutionRows: truthRows.filter((row) => row.status === "solution"),
  };
}

function buildAdjustedRows(membershipRows, conditionNames, outcomeByCase) {
  const adjustedMembershipRows = membershipRows.map((row) => {
    const adjusted = { case_id: row.case_id };
    conditionNames.forEach((name) => {
      const key = `${row.case_id}|${name}`;
      const override = state.overrides[key];
      adjusted[name] = override === undefined || override === "" ? row[name] : format(Number(override));
    });
    return adjusted;
  });
  const adjustedQcaRows = adjustedMembershipRows.map((row) => ({
    ...row,
    outcome: outcomeByCase[row.case_id] ?? "",
  }));
  return { adjustedMembershipRows, adjustedQcaRows };
}

function buildSensitivityRows(qcaRows, conditionNames, settings, hasOutcome) {
  return settings.sensitivityThresholds.map((threshold) => {
    const outputs = buildQcaOutputs(qcaRows, conditionNames, settings, hasOutcome, threshold);
    const consistencies = outputs.truthRows.map((row) => Number(row.consistency || 0));
    const averageConsistency = consistencies.length
      ? consistencies.reduce((sum, value) => sum + value, 0) / consistencies.length
      : 0;
    return {
      threshold: format(threshold),
      truth_table_configurations: outputs.truthRows.length,
      solution_configurations: outputs.solutionRows.length,
      average_consistency: hasOutcome ? format(averageConsistency) : "",
    };
  });
}

function runAnalysis() {
  const textColumn = el("textColumn").value;
  const caseColumn = el("caseColumn").value;
  const outcomeColumn = el("outcomeColumn").value;
  const settings = readSettings();
  if (!state.textRows.length) throw new Error("Please load a text dataset.");
  if (!state.prototypeRows.length) throw new Error("Please load prototype rows.");
  if (!textColumn) throw new Error("Please select a text column.");

  const conditions = state.prototypeRows
    .filter((row) => String(row.type || "condition").trim().toLowerCase() !== "outcome")
    .filter((row) => row.condition_name && row.prototype);
  if (!conditions.length) throw new Error("Prototype CSV must include at least one condition row.");

  const prototypeVectors = Object.fromEntries(conditions.map((row) => [row.condition_name, tokenize(row.prototype)]));
  const scoreRows = [];
  const membershipRows = [];
  const explanationRows = [];
  const outcomeByCase = {};
  const caseSummaryRows = [];

  state.textRows.forEach((caseRow, index) => {
    const caseId = caseRow[caseColumn] || String(index + 1);
    const text = caseRow[textColumn] || "";
    const textVector = tokenize(text);
    const scores = {};
    const memberships = {};
    conditions.forEach((condition) => {
      const name = condition.condition_name;
      const score = cosine(textVector, prototypeVectors[name]);
      const membership = settings.mode === "crisp"
        ? (score >= settings.crispThreshold ? 1 : 0)
        : fuzzyCalibrate(score, settings.fullIn, settings.crossOver, settings.fullOut);
      scores[name] = score;
      memberships[name] = membership;
      explanationRows.push({
        case_id: caseId,
        condition: name,
        score: format(score),
        membership: format(membership),
        overlapping_features: overlapTerms(textVector, prototypeVectors[name]) || "(no literal overlap)",
      });
    });
    const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    const scoreFields = Object.fromEntries(Object.entries(scores).map(([key, value]) => [`raw_${key}`, format(value)]));
    const membershipFields = Object.fromEntries(Object.entries(memberships).map(([key, value]) => [`calibrated_${key}`, format(value)]));
    caseSummaryRows.push({
      case_id: caseId,
      text,
      top_matched_condition: top ? top[0] : "",
      top_similarity_score: top ? format(top[1]) : "",
      explanation: top ? `This case is closest to ${top[0]} based on prototype similarity.` : "",
      ...scoreFields,
      ...membershipFields,
    });
    scoreRows.push({ case_id: caseId, text, ...Object.fromEntries(Object.entries(scores).map(([key, value]) => [key, format(value)])) });
    membershipRows.push({ case_id: caseId, ...Object.fromEntries(Object.entries(memberships).map(([key, value]) => [key, format(value)])) });
    outcomeByCase[caseId] = outcomeColumn ? format(parseOutcome(caseRow[outcomeColumn])) : "";
  });

  const conditionNames = conditions.map((row) => row.condition_name);
  const hasOutcome = outcomeColumn !== "";
  const { adjustedMembershipRows, adjustedQcaRows } = buildAdjustedRows(membershipRows, conditionNames, outcomeByCase);
  const qcaRows = membershipRows.map((row) => ({ ...row, outcome: outcomeByCase[row.case_id] ?? "" }));
  const qcaOutputs = buildQcaOutputs(adjustedQcaRows, conditionNames, settings, hasOutcome);
  const sensitivityRows = buildSensitivityRows(adjustedQcaRows, conditionNames, settings, hasOutcome);
  const heatmapRows = adjustedMembershipRows.flatMap((row) => conditionNames.map((name) => ({
    case_id: row.case_id,
    condition: name,
    membership: Number(row[name]),
  })));
  const finalByCase = Object.fromEntries(adjustedMembershipRows.map((row) => [row.case_id, row]));
  const enrichedCaseSummaryRows = caseSummaryRows.map((row) => ({
    ...row,
    ...Object.fromEntries(conditionNames.map((name) => [`final_${name}`, finalByCase[row.case_id]?.[name] ?? ""])),
  }));

  state.results = {
    settings,
    hasOutcome,
    conditions: conditionNames,
    scoreRows,
    membershipRows,
    adjustedMembershipRows,
    qcaRows,
    adjustedQcaRows,
    truthRows: qcaOutputs.truthRows,
    solutionRows: qcaOutputs.solutionRows,
    sensitivityRows,
    explanationRows,
    caseSummaryRows: enrichedCaseSummaryRows,
    heatmapRows,
  };
}

function renderSummary() {
  const results = state.results;
  const summary = el("summary");
  if (!results) {
    summary.innerHTML = "";
    return;
  }
  summary.innerHTML = `
    <div class="metric"><strong>${state.textRows.length}</strong><span>Cases analyzed</span></div>
    <div class="metric"><strong>${results.conditions.length}</strong><span>QCA conditions</span></div>
    <div class="metric"><strong>${results.truthRows.length}</strong><span>Truth-table rows</span></div>
    <div class="metric"><strong>${results.solutionRows.length}</strong><span>Solution configurations</span></div>
  `;
}

function renderTable(rows) {
  const wrap = el("tableWrap");
  if (!rows || !rows.length) {
    wrap.innerHTML = "<table><tbody><tr><td>No rows to display.</td></tr></tbody></table>";
    return;
  }
  const fields = Object.keys(rows[0]);
  wrap.innerHTML = `
    <table>
      <thead><tr>${fields.map((field) => `<th>${escapeHtml(field)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((row) => `<tr>${fields.map((field) => {
          const value = row[field] ?? "";
          const cls = field === "status" ? ` class="status-${String(value).replaceAll(" ", "-")}"` : "";
          return `<td${cls}>${escapeHtml(value)}</td>`;
        }).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
}

function recomputeAdjustedOutputs() {
  const results = state.results;
  if (!results) return;
  const outcomeByCase = Object.fromEntries(results.qcaRows.map((row) => [row.case_id, row.outcome]));
  const { adjustedMembershipRows, adjustedQcaRows } = buildAdjustedRows(results.membershipRows, results.conditions, outcomeByCase);
  const outputs = buildQcaOutputs(adjustedQcaRows, results.conditions, results.settings, results.hasOutcome);
  const sensitivityRows = buildSensitivityRows(adjustedQcaRows, results.conditions, results.settings, results.hasOutcome);
  const heatmapRows = adjustedMembershipRows.flatMap((row) => results.conditions.map((name) => ({
    case_id: row.case_id,
    condition: name,
    membership: Number(row[name]),
  })));
  const finalByCase = Object.fromEntries(adjustedMembershipRows.map((row) => [row.case_id, row]));
  const caseSummaryRows = results.caseSummaryRows.map((row) => {
    const clean = Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith("final_")));
    return {
      ...clean,
      ...Object.fromEntries(results.conditions.map((name) => [`final_${name}`, finalByCase[row.case_id]?.[name] ?? ""])),
    };
  });
  state.results = {
    ...results,
    adjustedMembershipRows,
    adjustedQcaRows,
    truthRows: outputs.truthRows,
    solutionRows: outputs.solutionRows,
    sensitivityRows,
    heatmapRows,
    caseSummaryRows,
  };
}

function renderAdjustmentTable() {
  const results = state.results;
  const wrap = el("adjustmentWrap");
  if (!results) {
    wrap.innerHTML = "";
    return;
  }
  const rows = results.membershipRows;
  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>case_id</th>
          ${results.conditions.map((name) => `<th>${escapeHtml(name)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.case_id)}</td>
            ${results.conditions.map((name) => {
              const key = `${row.case_id}|${name}`;
              const adjusted = results.adjustedMembershipRows.find((item) => item.case_id === row.case_id)?.[name] ?? row[name];
              return `
                <td>
                  <div class="override-cell">
                    <small>original ${escapeHtml(row[name])}</small>
                    <input class="mini-input" data-override-key="${escapeHtml(key)}" type="number" min="0" max="1" step="0.01" value="${escapeHtml(adjusted)}">
                  </div>
                </td>
              `;
            }).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  wrap.querySelectorAll("[data-override-key]").forEach((input) => {
    const applyOverride = () => {
      const value = Math.max(0, Math.min(1, Number(input.value)));
      if (!Number.isFinite(value)) return;
      state.overrides[input.dataset.overrideKey] = format(value);
      input.value = format(value);
      recomputeAdjustedOutputs();
      renderAll();
      setMessage("Manual adjustment applied. QCA outputs now use adjusted memberships.");
    };
    input.addEventListener("change", applyOverride);
    input.addEventListener("input", () => {
      const value = Number(input.value);
      if (!Number.isFinite(value) || value < 0 || value > 1) return;
      state.overrides[input.dataset.overrideKey] = format(value);
      recomputeAdjustedOutputs();
      renderSummary();
      renderSensitivity();
      renderHeatmap();
      renderScatter();
      renderActiveTab();
    });
  });
}

function renderHeatmap() {
  const results = state.results;
  const heatmap = el("heatmap");
  if (!results) {
    heatmap.innerHTML = "";
    return;
  }
  const cases = [...new Set(results.heatmapRows.map((row) => row.case_id))];
  const conditions = results.conditions;
  const lookup = Object.fromEntries(results.heatmapRows.map((row) => [`${row.case_id}|${row.condition}`, row.membership]));
  const columns = conditions.length + 1;
  const cells = [`<div class="heat-label">case</div>`, ...conditions.map((name) => `<div class="heat-label">${name}</div>`)];
  cases.forEach((caseId) => {
    cells.push(`<div class="heat-label">${caseId}</div>`);
    conditions.forEach((condition) => {
      const value = lookup[`${caseId}|${condition}`] || 0;
      const color = `rgba(43, 122, 91, ${0.12 + value * 0.78})`;
      cells.push(`<div class="heat-cell" style="background:${color}">${format(value)}</div>`);
    });
  });
  heatmap.innerHTML = `<div class="heat-grid" style="grid-template-columns: repeat(${columns}, minmax(86px, 1fr))">${cells.join("")}</div>`;
}

function renderScatter() {
  const results = state.results;
  const scatter = el("scatter");
  if (!results) {
    scatter.innerHTML = "";
    return;
  }
  const dots = results.truthRows.map((row) => {
    const x = Math.max(4, Math.min(96, Number(row.coverage || 0) * 92 + 4));
    const y = Math.max(8, Math.min(92, Number(row.consistency || 0) * 84 + 8));
    const cls = row.status === "solution" ? "" : (row.status === "contradictory" ? " weak" : " bad");
    return `<div class="dot${cls}" style="left:${x}%; bottom:${y}%"><span>${row.configuration} (${row.n_cases})</span></div>`;
  });
  scatter.innerHTML = `<div class="axis y">consistency</div><div class="axis x">coverage</div>${dots.join("")}`;
}

function renderSensitivity() {
  const results = state.results;
  const plot = el("sensitivityPlot");
  const wrap = el("sensitivityWrap");
  if (!results) {
    plot.innerHTML = "";
    wrap.innerHTML = "";
    return;
  }
  const maxConfigurations = Math.max(1, ...results.sensitivityRows.map((row) => Number(row.truth_table_configurations)));
  const maxSolutions = Math.max(1, ...results.sensitivityRows.map((row) => Number(row.solution_configurations)));
  plot.innerHTML = results.sensitivityRows.map((row) => {
    const configHeight = Math.max(3, (Number(row.truth_table_configurations) / maxConfigurations) * 112);
    const solutionHeight = Math.max(3, (Number(row.solution_configurations) / maxSolutions) * 112);
    return `
      <div class="bar-group" title="threshold ${escapeHtml(row.threshold)}">
        <div class="bar-stack">
          <div class="bar" style="height:${configHeight}px"></div>
          <div class="bar solution" style="height:${solutionHeight}px"></div>
        </div>
        <div class="bar-label">${escapeHtml(row.threshold)}</div>
      </div>
    `;
  }).join("");
  const fields = Object.keys(results.sensitivityRows[0] || {});
  wrap.innerHTML = `
    <table>
      <thead><tr>${fields.map((field) => `<th>${escapeHtml(field)}</th>`).join("")}</tr></thead>
      <tbody>
        ${results.sensitivityRows.map((row) => `<tr>${fields.map((field) => `<td>${escapeHtml(row[field])}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
}

function renderActiveTab() {
  if (!state.results) return;
  const map = {
    scores: state.results.scoreRows,
    memberships: state.results.membershipRows,
    adjusted: state.results.adjustedMembershipRows,
    caseSummary: state.results.caseSummaryRows,
    truth: state.results.truthRows,
    solutions: state.results.solutionRows,
    explanations: state.results.explanationRows,
  };
  renderTable(map[state.activeTab]);
}

function renderAll() {
  recomputeAdjustedOutputs();
  renderSummary();
  renderAdjustmentTable();
  renderSensitivity();
  renderHeatmap();
  renderScatter();
  renderActiveTab();
}

function buildMarkdownReport() {
  const results = state.results;
  if (!results) return "# Analysis Report\n\nNo analysis has been run.\n";
  const solutionLines = results.solutionRows.length
    ? results.solutionRows.map((row) => `- ${row.configuration}: cases ${row.case_ids}; consistency ${row.consistency}; coverage ${row.coverage}`).join("\n")
    : "- No solution configurations met the selected criteria.";
  return `# Text-to-QCA Analysis Report

## Dataset

- Cases analyzed: ${state.textRows.length}
- Selected conditions: ${results.conditions.join(", ")}
- Calibration method: ${results.settings.mode}
- Crisp threshold used for main truth table: ${format(results.settings.crispThreshold)}
- Minimum cases: ${results.settings.minCases}
- Consistency cutoff: ${format(results.settings.consistencyCutoff)}

## Results

- Truth-table configurations: ${results.truthRows.length}
- Solution configurations: ${results.solutionRows.length}

## Solution Configurations

${solutionLines}

## Threshold Sensitivity

${results.sensitivityRows.map((row) => `- Threshold ${row.threshold}: ${row.truth_table_configurations} configurations, ${row.solution_configurations} solutions, average consistency ${row.average_consistency}`).join("\n")}

## Human-In-The-Loop Adjustment

Adjusted membership values may reflect researcher judgment. Any manual override
should be theoretically justified and reported alongside the original
computational membership.

## Key Limitations

- Prototype-based scoring is transparent assistance, not final human coding.
- Results depend on prototype quality, calibration anchors, and threshold choices.
- Small datasets can produce unstable truth tables and apparent configurations.
- The bilingual concept bridge should be audited before use in a new project.
`;
}

function setMessage(text, isError = false) {
  el("message").textContent = text;
  el("message").className = isError ? "message error" : "message";
}

function loadDemo() {
  state.overrides = {};
  state.textRows = parseCsv(demoTextCsv);
  state.prototypeRows = parseCsv(demoPrototypeCsv);
  updateColumnControls();
  runAnalysis();
  renderAll();
  setMessage("Demo data loaded. Scores, memberships, truth table, and solution configurations are ready.");
}

async function loadFile(input, target) {
  const file = input.files[0];
  if (!file) return;
  const text = await file.text();
  state.overrides = {};
  state[target] = parseCsv(text);
  if (target === "textRows") updateColumnControls();
  setMessage(`${file.name} loaded.`);
}

document.addEventListener("DOMContentLoaded", () => {
  el("loadDemo").addEventListener("click", loadDemo);
  el("resetDemo").addEventListener("click", loadDemo);
  el("textFile").addEventListener("change", (event) => loadFile(event.target, "textRows"));
  el("protoFile").addEventListener("change", (event) => loadFile(event.target, "prototypeRows"));
  el("runAnalysis").addEventListener("click", () => {
    try {
      runAnalysis();
      renderAll();
      setMessage("Analysis completed.");
    } catch (error) {
      setMessage(error.message, true);
    }
  });
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      state.activeTab = button.dataset.tab;
      renderActiveTab();
    });
  });
  document.querySelectorAll("[data-download]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.results) return;
      const exports = {
        scores: ["similarity_scores.csv", state.results.scoreRows],
        memberships: ["calibrated_membership.csv", state.results.membershipRows],
        adjustedMembership: ["adjusted_membership.csv", state.results.adjustedMembershipRows],
        qcaReady: ["qca_ready_dataset.csv", state.results.adjustedQcaRows],
        truthTable: ["truth_table.csv", state.results.truthRows],
        solutions: ["solution_configurations.csv", state.results.solutionRows],
        sensitivity: ["threshold_sensitivity.csv", state.results.sensitivityRows],
      };
      if (button.dataset.download === "report") {
        downloadText("analysis_report.md", buildMarkdownReport());
        return;
      }
      const item = exports[button.dataset.download];
      if (item) downloadCsv(item[0], item[1]);
    });
  });
  loadDemo();
});
