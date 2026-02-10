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

async function loadNotices() {
  const container = document.getElementById("noticeList");
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
      .map(
        (notice) => `
        <div class="notice-card">
          <div class="notice-info">
            <strong>${notice.title}</strong>
            <p>${notice.body_md || ""}</p>
            <div class="notice-meta">
              <span>対象: ${notice.target}</span>
              <span>期間: ${formatDate(notice.start_at)} - ${formatDate(notice.end_at)}</span>
            </div>
          </div>
          <div class="notice-actions">
            <button class="delete-btn" data-id="${notice.notice_id}">削除</button>
          </div>
        </div>
      `
      )
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

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

async function createNotice() {
  const title = document.getElementById("title")?.value.trim();
  const body = document.getElementById("body_md")?.value.trim();
  const target = document.getElementById("target")?.value;
  const startAt = document.getElementById("start_at")?.value;
  const endAt = document.getElementById("end_at")?.value;

  if (!title || !body || !startAt || !endAt) {
    alert("必要項目を入力してください。");
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
