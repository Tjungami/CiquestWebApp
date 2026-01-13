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
  loadUsers();
});

function bindTabs() {
  const tabs = document.querySelectorAll(".user-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeType = tab.dataset.type;
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

async function loadUsers() {
  const container = document.getElementById("userList");
  container.innerHTML = "<p>Loading...</p>";

  const keyword = document.getElementById("userSearch").value.trim();
  const baseUrl = TYPE_CONFIG[activeType].listUrl;
  const url = keyword ? `${baseUrl}?search=${encodeURIComponent(keyword)}` : baseUrl;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = '<p class="user-empty">No users found.</p>';
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
    container.innerHTML = '<p class="user-empty">Failed to load users.</p>';
  }
}

function renderCard(item) {
  if (activeType === "admin") {
    const createdAt = item.created_at ? new Date(item.created_at).toLocaleString() : "-";
    return `
      <div class="user-card">
        <div class="user-card__row">
          <div>
            <strong>${escapeHtml(item.name || "")}</strong><br>
            <span>${escapeHtml(item.email || "")}</span>
          </div>
          <span class="user-points">${escapeHtml(item.approval_status || "")}</span>
        </div>
        <div class="user-meta">
          <span>Active: ${item.is_active ? "Yes" : "No"}</span>
          <span>Deleted: ${item.is_deleted ? "Yes" : "No"}</span>
          <span>Created: ${createdAt}</span>
        </div>
        <div class="user-actions">
          <button class="delete-btn" data-id="${item.admin_id}" data-name="${escapeHtml(item.name || "")}">Delete</button>
        </div>
      </div>
    `;
  }

  if (activeType === "owner") {
    const createdAt = item.created_at ? new Date(item.created_at).toLocaleString() : "-";
    const displayName = item.business_name || item.name || "(no name)";
    return `
      <div class="user-card">
        <div class="user-card__row">
          <div>
            <strong>${escapeHtml(displayName)}</strong><br>
            <span>${escapeHtml(item.email || "")}</span>
          </div>
          <span class="user-points">Approved: ${item.approved ? "Yes" : "No"}</span>
        </div>
        <div class="user-meta">
          <span>Verified: ${item.is_verified ? "Yes" : "No"}</span>
          <span>Onboarding: ${item.onboarding_completed ? "Yes" : "No"}</span>
          <span>Created: ${createdAt}</span>
        </div>
        <div class="user-actions">
          <button class="delete-btn" data-id="${item.owner_id}" data-name="${escapeHtml(displayName)}">Delete</button>
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
        <span class="user-points">${item.points || 0} pt</span>
      </div>
      <div class="user-meta">
        <span>Rank: ${escapeHtml(item.rank || "-")}</span>
        <span>Created: ${createdAt}</span>
      </div>
      <div class="user-actions">
        <button class="delete-btn" data-id="${item.user_id}" data-name="${escapeHtml(item.username || "")}">Delete</button>
      </div>
    </div>
  `;
}

async function deleteUser(id, name) {
  const confirmMsg = `Delete user "${name}"? This cannot be undone.`;
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
    alert("Deleted.");
    loadUsers();
  } catch (err) {
    alert(`Delete failed. ${err.message || ""}`);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
