const TYPE_CONFIG = {
  admin: {
    listUrl: "/operator/api/admins/",
    deleteUrl: (id) => `/operator/api/admins/${id}/delete/`,
  },
  owner: {
    listUrl: "/operator/api/owners/",
    deleteUrl: (id) => `/operator/api/owners/${id}/delete/`,
  },
  user: {
    listUrl: "/operator/api/users/",
    deleteUrl: (id) => `/operator/api/users/${id}/delete/`,
  },
};

const CSRF_TOKEN = getCsrfToken();
let activeType = "admin";

document.addEventListener("DOMContentLoaded", () => {
  bindTabs();
  bindSearch();
  updateAdminCreateLink();
  loadUsers();
});

function bindTabs() {
  const tabs = document.querySelectorAll(".user-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeType = tab.dataset.type;
      updateAdminCreateLink();
      loadUsers();
    });
  });
}

function bindSearch() {
  const searchBtn = document.getElementById("userSearchBtn");
  const searchInput = document.getElementById("userSearch");
  searchBtn.addEventListener("click", () => loadUsers());
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      loadUsers();
    }
  });
}

function getCsrfToken() {
  const value = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("csrftoken="));
  return value ? decodeURIComponent(value.split("=")[1]) : "";
}

function updateAdminCreateLink() {
  const link = document.getElementById("adminCreateLink");
  if (!link) return;
  link.classList.toggle("is-hidden", activeType !== "admin");
}

async function loadUsers() {
  const container = document.getElementById("userList");
  container.innerHTML = "<p>読み込み中です...</p>";

  const keyword = document.getElementById("userSearch").value.trim();
  const baseUrl = TYPE_CONFIG[activeType].listUrl;
  const url = keyword ? `${baseUrl}?search=${encodeURIComponent(keyword)}` : baseUrl;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = '<p class="user-empty">該当するユーザーがいません。</p>';
      return;
    }

    container.innerHTML = data.map((item) => renderCard(item)).join("");
    container.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async (event) => {
        const { id, name } = event.currentTarget.dataset;
        await deleteUser(id, name);
      });
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="user-empty">ユーザーの取得に失敗しました。</p>';
  }
}

function renderCard(item) {
  if (activeType === "admin") {
    const createdAt = item.created_at ? new Date(item.created_at).toLocaleString() : "-";
    const approvalLabel = approvalStatusLabel(item.approval_status);
    return `
      <div class="user-card">
        <div class="user-card__row">
          <div>
            <strong>${escapeHtml(item.name || "")}</strong><br>
            <span>${escapeHtml(item.email || "")}</span>
          </div>
          <span class="user-points">承認状況: ${approvalLabel}</span>
        </div>
        <div class="user-meta">
          <span>有効: ${boolLabel(item.is_active)}</span>
          <span>削除済み: ${boolLabel(item.is_deleted)}</span>
          <span>登録日: ${createdAt}</span>
        </div>
        <div class="user-actions">
          <button class="delete-btn" data-id="${item.admin_id}" data-name="${escapeHtml(item.name || "")}">削除</button>
        </div>
      </div>
    `;
  }

  if (activeType === "owner") {
    const createdAt = item.created_at ? new Date(item.created_at).toLocaleString() : "-";
    const displayName = item.business_name || item.name || "(未設定)";
    return `
      <div class="user-card">
        <div class="user-card__row">
          <div>
            <strong>${escapeHtml(displayName)}</strong><br>
            <span>${escapeHtml(item.email || "")}</span>
          </div>
          <span class="user-points">承認済み: ${boolLabel(item.approved)}</span>
        </div>
        <div class="user-meta">
          <span>メール確認: ${boolLabel(item.is_verified)}</span>
          <span>初期設定完了: ${boolLabel(item.onboarding_completed)}</span>
          <span>登録日: ${createdAt}</span>
        </div>
        <div class="user-actions">
          <button class="delete-btn" data-id="${item.owner_id}" data-name="${escapeHtml(displayName)}">削除</button>
        </div>
      </div>
    `;
  }

  const createdAt = item.created_at ? new Date(item.created_at).toLocaleString() : "-";
  return `
    <div class="user-card">
      <div class="user-card__row">
        <div>
          <strong>${escapeHtml(item.username || "")}</strong><br>
          <span>${escapeHtml(item.email || "")}</span>
        </div>
        <span class="user-points">${item.points || 0} ポイント</span>
      </div>
      <div class="user-meta">
        <span>ランク: ${escapeHtml(item.rank || "-")}</span>
        <span>登録日: ${createdAt}</span>
      </div>
      <div class="user-actions">
        <button class="delete-btn" data-id="${item.user_id}" data-name="${escapeHtml(item.username || "")}">削除</button>
      </div>
    </div>
  `;
}

async function deleteUser(id, name) {
  const confirmMsg = `ユーザー「${name}」を削除しますか？この操作は取り消せません。`;
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(TYPE_CONFIG[activeType].deleteUrl(id), {
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
    loadUsers();
  } catch (err) {
    alert(`削除に失敗しました。${err.message ? ` ${err.message}` : ""}`);
  }
}

function boolLabel(value) {
  return value ? "はい" : "いいえ";
}

function approvalStatusLabel(status) {
  if (status === "approved") return "承認済み";
  if (status === "rejected") return "却下";
  if (status === "pending") return "申請中";
  return escapeHtml(status || "-");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
