const API_BASE = "/operator/api/inquiries";
const CSRF_TOKEN = getCsrfToken();

document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      loadInquiries(tab.dataset.status);
    });
  });

  loadInquiries("unread");
});

function getCsrfToken() {
  const value = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("csrftoken="));
  return value ? decodeURIComponent(value.split("=")[1]) : "";
}

async function loadInquiries(status) {
  const container = document.getElementById("inquiryList");
  container.innerHTML = "<p>読み込み中です…</p>";

  try {
    const res = await fetch(`${API_BASE}/?status=${encodeURIComponent(status)}`);
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = "<p>該当するお問い合わせはありません。</p>";
      return;
    }

    container.innerHTML = data
      .map(
        (item) => `
          <div class="inquiry-card">
            <div class="inquiry-header">
              <span class="inquiry-category">${item.category}</span>
              <small>${new Date(item.created_at).toLocaleString()}</small>
            </div>
            <p class="inquiry-message">${item.message}</p>
            ${
              item.related_challenge_id
                ? `<p class="related-info">関連チャレンジID: ${item.related_challenge_id}</p>`
                : ""
            }
            <div class="inquiry-actions">
              ${
                status !== "resolved"
                  ? `<button class="status-btn" data-id="${item.inquiry_id}" data-next="${nextStatus(
                      status
                    )}">
                      ${nextStatusLabel(status)}
                    </button>`
                  : ""
              }
            </div>
          </div>
        `
      )
      .join("");

    container.querySelectorAll(".status-btn").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const target = event.currentTarget;
        updateStatus(target.dataset.id, target.dataset.next);
      });
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>データの取得に失敗しました。</p>";
  }
}

function nextStatus(current) {
  if (current === "unread") return "in_progress";
  if (current === "in_progress") return "resolved";
  return "resolved";
}

function nextStatusLabel(current) {
  if (current === "unread") return "対応中にする";
  if (current === "in_progress") return "対応済みにする";
  return "完了";
}

async function updateStatus(id, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/${id}/update_status/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": CSRF_TOKEN,
      },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) throw new Error();
    const active = document.querySelector(".tab.active").dataset.status;
    loadInquiries(active);
  } catch (err) {
    alert("状態変更に失敗しました。");
  }
}
