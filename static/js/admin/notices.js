const API_BASE = "/operator/api/notices";
const CSRF_TOKEN = getCsrfToken();

document.addEventListener("DOMContentLoaded", () => {
  loadNotices();

  const form = document.getElementById("noticeForm");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await addNotice();
  });
});

function getCsrfToken() {
  const value = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("csrftoken="));
  return value ? decodeURIComponent(value.split("=")[1]) : "";
}

async function loadNotices() {
  const container = document.getElementById("noticeContainer");
  container.innerHTML = "<p>読み込み中です…</p>";

  try {
    const res = await fetch(`${API_BASE}/`);
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = "<p>お知らせはまだ登録されていません。</p>";
      return;
    }

    container.innerHTML = data
      .map(
        (notice) => `
        <article class="notice-card">
          <header>
            <div>
              <h3>${escapeHtml(notice.title)}</h3>
              <div class="notice-meta">
                <span class="badge">${targetLabel(notice.target)}</span>
                <span>${formatPeriod(notice.start_at, notice.end_at)}</span>
              </div>
            </div>
            <div class="notice-actions">
              <span class="status ${notice.is_published ? "published" : "draft"}">
                ${notice.is_published ? "公開中" : "下書き"}
              </span>
              <button class="delete-btn" data-id="${notice.notice_id}">削除</button>
            </div>
          </header>
          <div class="notice-body">${notice.body_html || ""}</div>
        </article>
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
    container.innerHTML = "<p>取得に失敗しました。</p>";
  }
}

async function addNotice() {
  const title = document.getElementById("noticeTitle").value.trim();
  const bodyMd = document.getElementById("noticeBody").value.trim();
  const target = document.getElementById("noticeTarget").value;
  const startAt = document.getElementById("noticeStart").value;
  const endAt = document.getElementById("noticeEnd").value;
  const isPublished = document.getElementById("noticePublished").checked;

  if (!title || !bodyMd || !target || !startAt || !endAt) {
    alert("必須項目を入力してください。");
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
        body_md: bodyMd,
        target,
        start_at: startAt,
        end_at: endAt,
        is_published: isPublished,
      }),
    });
    if (!res.ok) throw new Error();
    document.getElementById("noticeForm").reset();
    loadNotices();
  } catch (err) {
    alert("お知らせの追加に失敗しました。");
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
    alert("削除に失敗しました。");
  }
}

function targetLabel(target) {
  if (target === "owner") return "オーナー";
  if (target === "user") return "ユーザー";
  return "全員";
}

function formatPeriod(startAt, endAt) {
  const start = startAt ? new Date(startAt).toLocaleString() : "-";
  const end = endAt ? new Date(endAt).toLocaleString() : "-";
  return `${start} 〜 ${end}`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
