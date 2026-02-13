const API_BY_TYPE = {
  admin: "/operator/api/admins",
  owner: "/operator/api/owners",
  user: "/operator/api/users",
};

const TYPE_LABEL = {
  admin: "運営ユーザー",
  owner: "オーナー",
  user: "一般ユーザー",
};

const ID_FIELD_BY_TYPE = {
  admin: "admin_id",
  owner: "owner_id",
  user: "user_id",
};

const CSRF_TOKEN = getCsrfToken();
let currentType = "admin";
let currentKeyword = "";

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  updateToolbar();
  loadUsers();
});

function bindEvents() {
  document.querySelectorAll(".user-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const nextType = tab.dataset.type;
      if (!API_BY_TYPE[nextType] || nextType === currentType) return;
      currentType = nextType;
      setActiveTab(nextType);
      updateToolbar();
      loadUsers();
    });
  });

  const searchInput = document.getElementById("userSearch");
  const searchBtn = document.getElementById("userSearchBtn");

  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      currentKeyword = (searchInput?.value || "").trim();
      loadUsers();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      currentKeyword = (searchInput.value || "").trim();
      loadUsers();
    });
  }
}

function setActiveTab(type) {
  document.querySelectorAll(".user-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.type === type);
  });
}

function updateToolbar() {
  const createLink = document.getElementById("adminCreateLink");
  if (!createLink) return;
  createLink.classList.toggle("is-hidden", currentType !== "admin");
}

function getCsrfToken() {
  const value = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("csrftoken="));
  return value ? decodeURIComponent(value.split("=")[1]) : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function renderMetaChips(item, type) {
  const chips = [];
  if (type === "user") {
    chips.push(`<span>ランク: ${escapeHtml(item.rank || "-")}</span>`);
    chips.push(`<span>ポイント: ${escapeHtml(item.points ?? 0)}</span>`);
  }
  if (type === "owner") {
    chips.push(`<span>事業者名: ${escapeHtml(item.business_name || "-")}</span>`);
    chips.push(`<span>本人確認: ${item.is_verified ? "済み" : "未確認"}</span>`);
    chips.push(`<span>承認: ${item.approved ? "承認済み" : "未承認"}</span>`);
  }
  if (type === "admin") {
    chips.push(`<span>承認状態: ${escapeHtml(item.approval_status || "-")}</span>`);
    chips.push(`<span>状態: ${item.is_active ? "有効" : "無効"}</span>`);
  }
  return chips.join("");
}

function renderUserCard(item, type) {
  const idField = ID_FIELD_BY_TYPE[type];
  const id = item[idField];
  const name = item.username || item.name || item.business_name || "-";
  const email = item.email || "-";
  const createdAt = formatDate(item.created_at);

  return `
    <div class="user-card">
      <div class="user-card__row">
        <div class="user-info">
          <strong>${escapeHtml(name)}</strong><br>
          ${escapeHtml(email)}<br>
          <small>登録日: ${escapeHtml(createdAt)}</small>
        </div>
      </div>
      <div class="user-meta">${renderMetaChips(item, type)}</div>
      <div class="user-actions">
        <button class="delete-btn" data-id="${escapeHtml(id)}" data-name="${escapeHtml(name)}">削除</button>
      </div>
    </div>
  `;
}

async function loadUsers() {
  const container = document.getElementById("userList");
  if (!container) return;
  container.innerHTML = "<p>読み込み中です...</p>";

  const base = API_BY_TYPE[currentType];
  if (!base) {
    container.innerHTML = "<p>不正なタブです。</p>";
    return;
  }

  const url = new URL(`${base}/`, window.location.origin);
  if (currentKeyword) {
    url.searchParams.set("search", currentKeyword);
  }

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = `<p class="user-empty">${TYPE_LABEL[currentType]}が見つかりません。</p>`;
      return;
    }

    container.innerHTML = data.map((item) => renderUserCard(item, currentType)).join("");

    container.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const { id, name } = event.currentTarget.dataset;
        deleteUser(id, name, currentType);
      });
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="user-empty">データの取得に失敗しました。</p>';
  }
}

async function deleteUser(id, name, type) {
  if (!id || !API_BY_TYPE[type]) return;
  if (!confirm(`${name} を削除しますか？`)) return;
  try {
    const res = await fetch(`${API_BY_TYPE[type]}/${id}/delete/`, {
      method: "DELETE",
      headers: {
        "X-CSRFToken": CSRF_TOKEN,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "削除に失敗しました。");
    }
    loadUsers();
  } catch (err) {
    alert(err.message || "ユーザーの削除に失敗しました。");
  }
}
