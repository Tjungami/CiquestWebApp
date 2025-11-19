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
      container.innerHTML = "<p>該当する店舗はありません。</p>";
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
            ${
              status === "pending"
                ? `
                  <button class="approve-btn" data-store="${store.store_id}" data-next="approved">承認</button>
                  <button class="reject-btn" data-store="${store.store_id}" data-next="rejected">却下</button>
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
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>データの取得に失敗しました。</p>";
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
    alert("店舗ステータスの更新に失敗しました。");
  }
}
