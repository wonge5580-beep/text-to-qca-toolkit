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
  };
  if (!(settings.fullOut < settings.crossOver && settings.crossOver < settings.fullIn)) {
    throw new Error("Calibration anchors must satisfy full non-membership < crossover < full membership.");
  }
  return settings;
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
  const qcaRows = [];
  const explanationRows = [];
  const heatmapRows = [];

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
      heatmapRows.push({ case_id: caseId, condition: name, membership });
    });
    scoreRows.push({ case_id: caseId, text, ...Object.fromEntries(Object.entries(scores).map(([key, value]) => [key, format(value)])) });
    membershipRows.push({ case_id: caseId, ...Object.fromEntries(Object.entries(memberships).map(([key, value]) => [key, format(value)])) });
    qcaRows.push({
      case_id: caseId,
      ...Object.fromEntries(Object.entries(memberships).map(([key, value]) => [key, format(value)])),
      outcome: outcomeColumn ? format(parseOutcome(caseRow[outcomeColumn])) : "",
    });
  });

  const conditionNames = conditions.map((row) => row.condition_name);
  const hasOutcome = outcomeColumn !== "";
  const positiveCases = qcaRows.filter((row) => parseOutcome(row.outcome) >= 0.5).length;
  const grouped = {};
  qcaRows.forEach((row) => {
    const configuration = conditionNames.map((name) => (Number(row[name]) >= settings.crispThreshold ? "1" : "0")).join("");
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

  const solutionRows = truthRows.filter((row) => row.status === "solution");
  state.results = {
    settings,
    conditions: conditionNames,
    scoreRows,
    membershipRows,
    qcaRows,
    truthRows,
    solutionRows,
    explanationRows,
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
      <thead><tr>${fields.map((field) => `<th>${field}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((row) => `<tr>${fields.map((field) => {
          const value = row[field] ?? "";
          const cls = field === "status" ? ` class="status-${String(value).replaceAll(" ", "-")}"` : "";
          return `<td${cls}>${String(value)}</td>`;
        }).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
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

function renderActiveTab() {
  if (!state.results) return;
  const map = {
    scores: state.results.scoreRows,
    memberships: state.results.membershipRows,
    truth: state.results.truthRows,
    solutions: state.results.solutionRows,
    explanations: state.results.explanationRows,
  };
  renderTable(map[state.activeTab]);
}

function renderAll() {
  renderSummary();
  renderHeatmap();
  renderScatter();
  renderActiveTab();
}

function setMessage(text, isError = false) {
  el("message").textContent = text;
  el("message").className = isError ? "message error" : "message";
}

function loadDemo() {
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
      const rows = button.dataset.download === "qcaReady" ? state.results.qcaRows : state.results.truthRows;
      const name = button.dataset.download === "qcaReady" ? "qca_ready_dataset.csv" : "truth_table.csv";
      downloadCsv(name, rows);
    });
  });
  loadDemo();
});
