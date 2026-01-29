const API_BASE = "/operator/api/stores";
const STORES_CSRF_TOKEN = getCsrfToken();

document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      loadStores(tab.dataset.status);
    });
  });

  loadStores("pending");
});

function getCsrfToken() {
  const value = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("csrftoken="));
  return value ? decodeURIComponent(value.split("=")[1]) : "";
}

async function loadStores(status) {
  const container = document.getElementById("store-list");
  container.innerHTML = "<p>読み込み中です…</p>";

  try {
    const res = await fetch(`${API_BASE}/?status=${encodeURIComponent(status)}`);
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = "<p>該当する店�Eはありません、E/p>";
      return;
    }

    container.innerHTML = data
      .map(
        (store) => `
        <div class="store-card">
          <div class="store-info">
            <strong>${store.name}</strong><br>
            ${store.address || "住所未登録"}<br>
            <small>登録日: ${new Date(store.created_at).toLocaleDateString()}</small>
          </div>
          <div class="store-actions">
            <a class="detail-link" href="/operator/stores/${store.store_id}/">�ڍ�</a>
            ${
              status === "pending"
                ? `
                  <button class="approve-btn" data-store="${store.store_id}" data-next="approved">承誁E/button>
                  <button class="reject-btn" data-store="${store.store_id}" data-next="rejected">却丁E/button>
                `
                : ""
            }
            ${
              status === "approved"
                ? `
                  <button class="delete-btn" data-store="${store.store_id}" data-name="${store.name}">削除</button>
                `
                : ""
            }
          </div>
        </div>
      `
      )
      .join("");

    if (status === "pending") {
      document.querySelectorAll(".store-actions button").forEach((btn) => {
        btn.addEventListener("click", (event) => {
          const target = event.currentTarget;
          updateStatus(target.dataset.store, target.dataset.next);
        });
      });
    }
    if (status === "approved") {
      document.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", (event) => {
          const target = event.currentTarget;
          requestDelete(target.dataset.store, target.dataset.name || "");
        });
      });
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>チE�Eタの取得に失敗しました、E/p>";
  }
}

async function updateStatus(id, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/${id}/${newStatus}/`, {
      method: "POST",
      headers: {
        "X-CSRFToken": STORES_CSRF_TOKEN,
      },
    });
    if (!res.ok) throw new Error();
    const activeTab = document.querySelector(".tab.active").dataset.status;
    loadStores(activeTab);
  } catch (err) {
    alert("店�EスチE�Eタスの更新に失敗しました、E);
  }
}

function confirmDelete(storeName) {
  if (!confirm(`こ�E店�Eを削除します。本当によろしいですか�E�\n${storeName}`)) {
    return false;
  }
  const typed = prompt(
    `削除を実行するには、DELETE と入力してください、En${storeName}`
  );
  if (typed !== "DELETE") {
    alert("削除を中止しました、E);
    return false;
  }
  return confirm(`最終確認です。本当に削除しますか�E�\n${storeName}`);
}

async function requestDelete(id, storeName) {
  if (!confirmDelete(storeName)) {
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/${id}/delete/`, {
      method: "DELETE",
      headers: {
        "X-CSRFToken": STORES_CSRF_TOKEN,
      },
    });
    if (!res.ok) throw new Error();
    const activeTab = document.querySelector(".tab.active").dataset.status;
    loadStores(activeTab);
  } catch (err) {
    alert("削除に失敗しました。時間を置ぁE��再試行してください、E);
  }
}
