const API_BASE = "/operator/api/notices";
const CSRF_TOKEN = getCsrfToken();

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("noticeForm");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await createNotice();
    });
  }
  loadNotices();
});

function getCsrfToken() {
  const value = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("csrftoken="));
  return value ? decodeURIComponent(value.split("=")[1]) : "";
}

function targetLabel(target) {
  if (target === "owner") return "オーナー";
  if (target === "user") return "ユーザー";
  return "全員";
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

async function loadNotices() {
  const container = document.getElementById("noticeContainer");
  if (!container) return;
  container.innerHTML = "<p>読み込み中です...</p>";

  try {
    const res = await fetch(`${API_BASE}/`);
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = "<p>お知らせはありません。</p>";
      return;
    }

    container.innerHTML = data
      .map((notice) => {
        const bodyHtml = notice.body_html
          ? notice.body_html
          : `<p>${escapeHtml(notice.body_md || "")}</p>`;
        const statusClass = notice.is_published ? "published" : "draft";
        const statusLabel = notice.is_published ? "公開中" : "下書き";
        return `
        <div class="notice-card">
          <header>
            <div>
              <h3>${notice.title}</h3>
              <div class="notice-meta">
                <span class="badge">${targetLabel(notice.target)}</span>
                <span>開始: ${formatDate(notice.start_at)}</span>
                <span>終了: ${formatDate(notice.end_at)}</span>
              </div>
            </div>
            <div class="notice-actions">
              <span class="status ${statusClass}">${statusLabel}</span>
              <button class="delete-btn" data-id="${notice.notice_id}">削除</button>
            </div>
          </header>
          <div class="notice-body">${bodyHtml}</div>
        </div>
      `;
      })
      .join("");

    container.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        deleteNotice(event.currentTarget.dataset.id);
      });
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>データの取得に失敗しました。</p>";
  }
}

async function createNotice() {
  const title = document.getElementById("noticeTitle")?.value.trim();
  const body = document.getElementById("noticeBody")?.value.trim();
  const target = document.getElementById("noticeTarget")?.value;
  const startAt = document.getElementById("noticeStart")?.value;
  const endAt = document.getElementById("noticeEnd")?.value;
  const isPublished = document.getElementById("noticePublished")?.checked;

  if (!title || !body || !startAt || !endAt || !target) {
    alert("すべての項目を入力してください。");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": CSRF_TOKEN,
      },
      body: JSON.stringify({
        title,
        body_md: body,
        target,
        start_at: startAt,
        end_at: endAt,
        is_published: Boolean(isPublished),
      }),
    });
    if (!res.ok) throw new Error();
    document.getElementById("noticeForm")?.reset();
    loadNotices();
  } catch (err) {
    alert("お知らせの作成に失敗しました。");
  }
}

async function deleteNotice(id) {
  if (!confirm("このお知らせを削除しますか？")) return;
  try {
    const res = await fetch(`${API_BASE}/${id}/delete/`, {
      method: "DELETE",
      headers: {
        "X-CSRFToken": CSRF_TOKEN,
      },
    });
    if (!res.ok) throw new Error();
    loadNotices();
  } catch (err) {
    alert("お知らせの削除に失敗しました。");
  }
}
