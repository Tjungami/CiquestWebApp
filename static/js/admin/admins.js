const API_BASE = "/operator/api/admins";
const CSRF_TOKEN = getCsrfToken();

document.addEventListener("DOMContentLoaded", () => {
  loadAdmins();

  const form = document.getElementById("adminCreateForm");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createAdmin();
  });
});

function getCsrfToken() {
  const value = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("csrftoken="));
  return value ? decodeURIComponent(value.split("=")[1]) : "";
}

async function loadAdmins() {
  const container = document.getElementById("adminContainer");
  container.innerHTML = "<p>読み込み中です…</p>";

  try {
    const res = await fetch(`${API_BASE}/`);
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = '<p class="admin-empty">運営ユーザーがまだ登録されていません。</p>';
      return;
    }

    container.innerHTML = data
      .map((admin) => {
        const statusLabel =
          admin.approval_status === "approved"
            ? "承認済み"
            : admin.approval_status === "rejected"
            ? "却下"
            : "申請中";
        const createdAt = admin.created_at
          ? new Date(admin.created_at).toLocaleString()
          : "-";
        const approvedAt = admin.approved_at
          ? new Date(admin.approved_at).toLocaleString()
          : "-";
        const deletedBadge = admin.is_deleted
          ? `<span class="status-badge status-deleted">削除済み(復元可)</span>`
          : "";

        return `
        <div class="admin-card">
          <div class="admin-card__row">
            <div>
              <strong>${admin.name}</strong><br>
              <span>${admin.email}</span>
            </div>
            <span class="status-badge status-${admin.approval_status}">${statusLabel}</span>
            ${deletedBadge}
          </div>
          <div class="admin-meta">
            <span>申請者: ${admin.created_by || "―"}</span>
            <span>承認者: ${admin.approved_by || "―"}</span>
            <span>申請日: ${createdAt}</span>
            <span>承認日: ${approvedAt}</span>
          </div>
          <div class="admin-actions">
            <button class="delete-btn" data-id="${admin.admin_id}" data-name="${admin.name}">削除</button>
          </div>
        </div>
      `;
      })
      .join("");
    container.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async (event) => {
        const { id, name } = event.currentTarget.dataset;
        await deleteAdmin(id, name);
      });
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p class=\"admin-empty\">データの取得に失敗しました。</p>";
  }
}

async function createAdmin() {
  const name = document.getElementById("adminName").value.trim();
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value.trim();

  if (!name || !email || !password) {
    alert("氏名・メールアドレス・パスワードを入力してください。");
    return;
  }
  if (password.length < 8) {
    alert("パスワードは8文字以上にしてください。");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": CSRF_TOKEN,
      },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "failed");
    }
    document.getElementById("adminCreateForm").reset();
    alert("運営ユーザーを作成しました。");
    loadAdmins();
  } catch (err) {
    alert("申請の登録に失敗しました。 " + (err.message || ""));
  }
}

async function deleteAdmin(id, name) {
  const confirmMsg = `本当に${name}様のアカウントを削除しますか？`;
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(`${API_BASE}/${id}/delete/`, {
      method: "DELETE",
      headers: {
        "X-CSRFToken": CSRF_TOKEN,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "failed");
    }
    alert("削除しました。");
    loadAdmins();
  } catch (err) {
    alert("削除に失敗しました。 " + (err.message || ""));
  }
}
