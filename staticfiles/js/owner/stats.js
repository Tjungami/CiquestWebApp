// C:\Users\j_tagami\CiquestWebApp\static\js\owner\stats.js
// --- 統計画面モックデータ表示 ---
document.addEventListener("DOMContentLoaded", () => {
  const statElements = document.querySelectorAll(".stat-value");
  statElements.forEach((el) => animateNumber(el));

  const labelsDataElement = document.getElementById("stats-chart-labels");
  const valuesDataElement = document.getElementById("stats-chart-values");
  let labels = ["4月", "5月", "6月", "7月", "8月", "9月", "10月"];
  let values = [50, 80, 120, 150, 200, 240, 260];

  if (labelsDataElement && valuesDataElement) {
    try {
      const parsedLabels = JSON.parse(labelsDataElement.textContent || "[]");
      const parsedValues = JSON.parse(valuesDataElement.textContent || "[]");
      if (parsedLabels.length && parsedValues.length) {
        labels = parsedLabels;
        values = parsedValues;
      }
    } catch (error) {
      console.warn("チャートデータの解析に失敗しました。", error);
    }
  }

  const chartCanvas = document.getElementById("userTrendChart");
  if (!chartCanvas) {
    return;
  }

  const ctx = chartCanvas.getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "来店ユーザー数",
        data: values,
        borderColor: "#0078d7",
        backgroundColor: "rgba(0,120,215,0.1)",
        tension: 0.35,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true },
      },
    },
  });
});

function animateNumber(element) {
  const target = Number(element.dataset.value || 0);
  const suffix = element.dataset.suffix || "";
  const duration = 1000;
  const startTime = performance.now();

  const formatter = new Intl.NumberFormat("ja-JP");

  function update(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const current = Math.floor(target * progress);
    element.textContent = `${formatter.format(current)}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}
