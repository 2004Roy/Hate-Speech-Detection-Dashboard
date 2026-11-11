const state = {
  rows: [],
  filtered: [],
  columns: { text: null, label: null, source: null, confidence: null },
  chart: null
};

const $ = (id) => document.getElementById(id);
const aliases = {
  text: ["text", "post", "comment", "content", "sentence", "tweet", "review", "message"],
  label: ["label", "category", "class", "target", "sentiment", "prediction", "hate_label"],
  source: ["source", "dataset", "origin", "corpus"],
  confidence: ["confidence", "score", "probability", "prediction_score"]
};

function findColumn(headers, choices) {
  const normalized = headers.map(h => String(h).trim().toLowerCase());
  for (const choice of choices) {
    const index = normalized.indexOf(choice);
    if (index !== -1) return headers[index];
  }
  return null;
}

function normalizeLabel(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return "unknown";
  if (/(hate|toxic|abusive|offensive|বিদ্বেষ|ঘৃণা)/i.test(v)) return "hate";
  if (/(sarcasm|sarcastic|irony|ব্যঙ্গ|বিদ্রূপ)/i.test(v)) return "sarcasm";
  if (/(neutral|non.?hate|not.?hate|normal|clean|নিরপেক্ষ)/i.test(v)) return "neutral";
  return "unknown";
}

function asConfidence(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  let n = Number(String(value).replace("%", "").trim());
  if (!Number.isFinite(n)) return null;
  if (n > 1 && n <= 100) n /= 100;
  return Math.max(0, Math.min(1, n));
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function setStatus(message, isError = false) {
  $("uploadStatus").textContent = message;
  $("uploadStatus").className = `mt-3 min-h-5 text-xs ${isError ? "text-rose-300" : "text-muted"}`;
}

function processRows(rawRows, fileName = "Dataset") {
  if (!rawRows.length) {
    setStatus("The CSV file is empty.", true);
    return;
  }

  const headers = Object.keys(rawRows[0] || {});
  state.columns = {
    text: findColumn(headers, aliases.text),
    label: findColumn(headers, aliases.label),
    source: findColumn(headers, aliases.source),
    confidence: findColumn(headers, aliases.confidence)
  };

  if (!state.columns.label) {
    setStatus("Could not find a label column. Try: label, category, class or prediction.", true);
    return;
  }

  state.rows = rawRows
    .filter(row => row && Object.values(row).some(v => String(v ?? "").trim() !== ""))
    .map((row, index) => ({
      id: index + 1,
      text: state.columns.text ? String(row[state.columns.text] ?? "") : "(Text column not found)",
      rawLabel: String(row[state.columns.label] ?? ""),
      label: normalizeLabel(row[state.columns.label]),
      source: state.columns.source ? String(row[state.columns.source] ?? "Unknown") : "Not provided",
      confidence: state.columns.confidence ? asConfidence(row[state.columns.confidence]) : null
    }));

  if (!state.rows.length) {
    setStatus("No usable rows were found in this CSV.", true);
    return;
  }

  $("fileName").textContent = fileName;
  populateSources();
  $("labelFilter").value = "all";
  $("sourceFilter").value = "all";
  $("confidenceFilter").value = "0";
  updateDashboard();
  const unknownCount = state.rows.filter(r => r.label === "unknown").length;
  setStatus(`${state.rows.length.toLocaleString()} rows loaded successfully.${unknownCount ? ` ${unknownCount} rows have unrecognized labels.` : ""}`);
}

function populateSources() {
  const select = $("sourceFilter");
  const sources = [...new Set(state.rows.map(r => r.source).filter(Boolean))].sort();
  select.innerHTML = '<option value="all">All sources</option>';
  sources.forEach(source => {
    const option = document.createElement("option");
    option.value = source;
    option.textContent = source;
    select.appendChild(option);
  });
  select.disabled = !state.columns.source;
  if (!state.columns.source) select.title = "Your CSV does not contain a source column";
}

function updateDashboard() {
  const selectedLabel = $("labelFilter").value;
  const selectedSource = $("sourceFilter").value;
  const minConfidence = Number($("confidenceFilter").value);

  state.filtered = state.rows.filter(row => {
    const labelMatch = selectedLabel === "all" || row.label === selectedLabel;
    const sourceMatch = selectedSource === "all" || row.source === selectedSource;
    const confidenceMatch = row.confidence === null || row.confidence >= minConfidence;
    return labelMatch && sourceMatch && confidenceMatch;
  });

  renderMetrics(state.filtered);
  renderChart(state.filtered);
  renderInsights(state.filtered);
  renderPreview(state.filtered);
  $("filterSummary").textContent = `Showing ${state.filtered.length.toLocaleString()} of ${state.rows.length.toLocaleString()} samples`;
}

function countsFor(rows) {
  const counts = { hate: 0, sarcasm: 0, neutral: 0, unknown: 0 };
  rows.forEach(row => counts[row.label] = (counts[row.label] || 0) + 1);
  return counts;
}

function percent(count, total) {
  return total ? `${(count / total * 100).toFixed(1)}%` : "0%";
}

function renderMetrics(rows) {
  const counts = countsFor(rows);
  $("totalSamples").textContent = rows.length.toLocaleString();
  $("hatePercent").textContent = percent(counts.hate, rows.length);
  $("sarcasmPercent").textContent = percent(counts.sarcasm, rows.length);
  $("neutralPercent").textContent = percent(counts.neutral, rows.length);
}

function renderChart(rows) {
  const counts = countsFor(rows);
  const values = [counts.neutral, counts.hate, counts.sarcasm];
  const labels = ["Neutral", "Hate speech", "Sarcasm"];
  const colors = ["#4F91F5", "#F05B68", "#9565F5"];

  if (state.chart) state.chart.destroy();
  state.chart = new Chart($("distributionChart"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: "#191d33",
        borderWidth: 4,
        hoverOffset: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#101428",
          padding: 12,
          callbacks: {
            label: context => ` ${context.label}: ${context.raw.toLocaleString()} (${percent(context.raw, rows.length)})`
          }
        }
      }
    },
    plugins: [{
      id: "centerText",
      afterDraw(chart) {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const x = (chartArea.left + chartArea.right) / 2;
        const y = (chartArea.top + chartArea.bottom) / 2;
        ctx.save();
        ctx.textAlign = "center";
        ctx.fillStyle = "#F4F5FF";
        ctx.font = "700 21px Inter, sans-serif";
        ctx.fillText(rows.length.toLocaleString(), x, y - 2);
        ctx.fillStyle = "#A7AAC4";
        ctx.font = "12px Inter, sans-serif";
        ctx.fillText("Samples", x, y + 18);
        ctx.restore();
      }
    }]
  });

  $("chartLegend").innerHTML = labels.map((label, i) => `
    <div class="rounded-xl bg-white/[.03] p-2">
      <div class="mb-1 flex items-center justify-center gap-1.5 text-xs text-muted">
        <span class="h-2 w-2 rounded-full" style="background:${colors[i]}"></span>${label}
      </div>
      <p class="font-semibold">${percent(values[i], rows.length)}</p>
      <p class="text-[10px] text-slate-500">${values[i].toLocaleString()} rows</p>
    </div>
  `).join("");
}

function renderInsights(rows) {
  const counts = countsFor(rows);
  const knownTotal = counts.hate + counts.sarcasm + counts.neutral;
  if (!rows.length) {
    $("insights").innerHTML = '<p class="text-sm text-muted">No records match the selected filters.</p>';
    return;
  }
  const ranked = [
    ["Hate speech", counts.hate],
    ["Sarcasm", counts.sarcasm],
    ["Neutral", counts.neutral]
  ].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const harmful = counts.hate + counts.sarcasm;
  const lines = [
    `${top[0]} is the largest recognized category (${percent(top[1], knownTotal)} of recognized labels).`,
    `Hate speech and sarcasm together account for ${percent(harmful, knownTotal)} of recognized labels.`,
    counts.unknown ? `${counts.unknown} rows have labels the dashboard could not classify.` : "All rows were mapped to a recognized dashboard category."
  ];
  $("insights").innerHTML = lines.map(line => `
    <div class="insight-row"><span class="insight-dot"></span><p class="text-sm leading-5 text-slate-300">${escapeHTML(line)}</p></div>
  `).join("");
}

function renderPreview(rows) {
  const preview = rows.slice(0, 5);
  $("previewCount").textContent = `${rows.length.toLocaleString()} records`;
  if (!preview.length) {
    $("previewBody").innerHTML = '<tr><td colspan="3" class="py-5 text-center text-muted">No matching records.</td></tr>';
    return;
  }
  $("previewBody").innerHTML = preview.map(row => {
    const labelColor = row.label === "hate" ? "bg-rose-500/15 text-rose-300"
      : row.label === "sarcasm" ? "bg-violet-500/15 text-violet-300"
      : row.label === "neutral" ? "bg-emerald-500/15 text-emerald-300"
      : "bg-slate-500/15 text-slate-300";
    const labelName = row.label === "hate" ? "Hate speech" : row.label === "unknown" ? row.rawLabel : row.label[0].toUpperCase() + row.label.slice(1);
    const confidence = row.confidence === null ? "—" : `${(row.confidence * 100).toFixed(0)}%`;
    return `<tr class="border-b border-white/5">
      <td class="max-w-[220px] truncate py-3 pr-3" title="${escapeHTML(row.text)}">${escapeHTML(row.text || "—")}</td>
      <td class="py-3 pr-3"><span class="label-pill ${labelColor}">${escapeHTML(labelName)}</span></td>
      <td class="py-3">${confidence}</td>
    </tr>`;
  }).join("");
}

function loadCSV(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".csv")) {
    setStatus("Please select a .csv file.", true);
    return;
  }
  $("fileName").textContent = file.name;
  setStatus("Reading your CSV file...");
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    encoding: "UTF-8",
    complete: results => {
      if (results.errors.length) {
        setStatus(`CSV warning: ${results.errors[0].message}`, true);
      }
      processRows(results.data, file.name);
    },
    error: error => setStatus(`Could not read file: ${error.message}`, true)
  });
}

// File picker
$("csvFile").addEventListener("change", event => loadCSV(event.target.files[0]));

// Drag and drop
const dropZone = $("dropZone");
["dragenter", "dragover"].forEach(name => dropZone.addEventListener(name, event => {
  event.preventDefault();
  dropZone.classList.add("dragover");
}));
["dragleave", "drop"].forEach(name => dropZone.addEventListener(name, event => {
  event.preventDefault();
  dropZone.classList.remove("dragover");
}));
dropZone.addEventListener("drop", event => loadCSV(event.dataTransfer.files[0]));

// Filters
["labelFilter", "sourceFilter", "confidenceFilter"].forEach(id => {
  $(id).addEventListener("change", updateDashboard);
});
$("resetFilters").addEventListener("click", () => {
  $("labelFilter").value = "all";
  $("sourceFilter").value = "all";
  $("confidenceFilter").value = "0";
  updateDashboard();
});

// Small built-in sample so the UI can be explored before uploading a real file.
$("loadDemo").addEventListener("click", () => {
  const demo = [
    { text: "এটি একটি উদাহরণ ঘৃণামূলক মন্তব্য", label: "Hate", source: "Demo", confidence: "0.96" },
    { text: "আজকের দিনটি খুব সুন্দর", label: "Neutral", source: "Demo", confidence: "0.91" },
    { text: "বাহ, দারুণ কাজ করেছ!", label: "Sarcasm", source: "Demo", confidence: "0.87" },
    { text: "মানুষের সঙ্গে সম্মানজনক আচরণ করা উচিত", label: "Neutral", source: "Demo", confidence: "0.94" },
    { text: "তোমার কথাবার্তা খুবই আপত্তিকর", label: "Hate", source: "Demo", confidence: "0.89" },
    { text: "অসাধারণ! আবারও ভুল করলে", label: "Sarcasm", source: "Demo", confidence: "0.78" },
    { text: "সবাই মিলে ভালো থাকি", label: "Neutral", source: "Demo", confidence: "0.83" },
    { text: "এমন মন্তব্য গ্রহণযোগ্য নয়", label: "Hate", source: "Demo", confidence: "0.73" }
  ];
  processRows(demo, "Demo dataset (sample only)");
});

// Initial empty state
renderMetrics([]);
renderChart([]);
