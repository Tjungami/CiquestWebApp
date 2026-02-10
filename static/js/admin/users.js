const API_BASE = "/operator/api/users";
const CSRF_TOKEN = getCsrfToken();

document.addEventListener("DOMContentLoaded", () => {
  loadUsers();
});

function getCsrfToken() {
  const value = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("csrftoken="));
  return value ? decodeURIComponent(value.split("=")[1]) : "";
}

async function loadUsers() {
  const container = document.getElementById("userList");
  if (!container) return;
  container.innerHTML = "<p>読み込み中です...</p>";

  try {
    const res = await fetch(`${API_BASE}/`);
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = "<p>ユーザーが見つかりません。</p>";
      return;
    }

    container.innerHTML = data
      .map(
        (user) => `
        <div class="user-card">
          <div class="user-info">
            <strong>${user.username}</strong><br>
            ${user.email}<br>
            <small>登録日: ${formatDate(user.created_at)}</small>
          </div>
          <div class="user-actions">
            <button class="delete-btn" data-id="${user.user_id}" data-name="${user.username}">削除</button>
          </div>
        </div>
      `
      )
      .join("");

    container.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const { id, name } = event.currentTarget.dataset;
        deleteUser(id, name);
      });
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>データの取得に失敗しました。</p>";
  }
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

async function deleteUser(id, name) {
  if (!confirm(`${name} を削除しますか？`)) return;
  try {
    const res = await fetch(`${API_BASE}/${id}/delete/`, {
      method: "DELETE",
      headers: {
        "X-CSRFToken": CSRF_TOKEN,
      },
    });
    if (!res.ok) throw new Error();
    loadUsers();
  } catch (err) {
    alert("ユーザー削除に失敗しました。");
  }
}
