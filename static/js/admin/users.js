const API_BASE = "/operator/api/users";
const CSRF_TOKEN = getCsrfToken();

document.addEventListener("DOMContentLoaded", () => {
  loadUsers();

  const searchBtn = document.getElementById("userSearchBtn");
  const searchInput = document.getElementById("userSearch");
  searchBtn.addEventListener("click", () => loadUsers(searchInput.value));
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      loadUsers(searchInput.value);
    }
  });
});

function getCsrfToken() {
  const value = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("csrftoken="));
  return value ? decodeURIComponent(value.split("=")[1]) : "";
}

async function loadUsers(keyword = "") {
  const container = document.getElementById("userList");
  container.innerHTML = "<p>Loading...</p>";

  const query = keyword.trim();
  const url = query ? `${API_BASE}/?search=${encodeURIComponent(query)}` : `${API_BASE}/`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = '<p class="user-empty">No users found.</p>';
      return;
    }

    container.innerHTML = data
      .map((user) => {
        const createdAt = user.created_at
          ? new Date(user.created_at).toLocaleString()
          : "-";
        return `
        <div class="user-card">
          <div class="user-card__row">
            <div>
              <strong>${user.username}</strong><br>
              <span>${user.email}</span>
            </div>
            <span class="user-points">${user.points} pts</span>
          </div>
          <div class="user-meta">
            <span>Rank: ${user.rank || "-"}</span>
            <span>Created: ${createdAt}</span>
          </div>
          <div class="user-actions">
            <button class="delete-btn" data-id="${user.user_id}" data-name="${user.username}">
              Delete
            </button>
          </div>
        </div>
      `;
      })
      .join("");

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

async function deleteUser(id, name) {
  const confirmMsg = `Delete user "${name}"? This cannot be undone.`;
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
    alert("User deleted.");
    loadUsers(document.getElementById("userSearch").value);
  } catch (err) {
    alert("Delete failed. " + (err.message || ""));
  }
}
