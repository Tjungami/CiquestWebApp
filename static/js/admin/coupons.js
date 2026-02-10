const API_BASE = "/operator/api/coupons";
const CSRF_TOKEN = getCsrfToken();

document.addEventListener("DOMContentLoaded", () => {
  const filter = document.getElementById("couponFilter");
  if (filter) {
    loadCoupons(filter.value);
    filter.addEventListener("change", (event) => {
      loadCoupons(event.target.value);
    });
  } else {
    loadCoupons();
  }

  const form = document.getElementById("couponForm");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await addCoupon();
    });
  }
});

function getCsrfToken() {
  const value = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("csrftoken="));
  return value ? decodeURIComponent(value.split("=")[1]) : "";
}

async function loadCoupons(type = "all") {
  const container = document.getElementById("couponContainer");
  if (!container) return;
  container.innerHTML = "<p>読み込み中です...</p>";

  try {
    const query =
      type && type !== "all" ? `?type=${encodeURIComponent(type)}` : "";
    const res = await fetch(`${API_BASE}/${query}`);
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = "<p>該当するクーポンがありません。</p>";
      return;
    }

    container.innerHTML = data
      .map(
        (coupon) => `
        <div class="coupon-card">
          <div class="coupon-info">
            <div class="coupon-meta">
              <span class="type-badge type-${coupon.type}">
                ${coupon.type === "store_specific" ? "店舗限定" : "共通"}
              </span>
              <span class="store-label">
                ${
                  coupon.type === "store_specific"
                    ? coupon.store_name || "店舗未設定"
                    : "全店舗"
                }
              </span>
            </div>
            <strong>${coupon.title}</strong>
            <p class="coupon-desc">${coupon.description || "説明なし"}</p>
            <div class="coupon-fields">
              <label>
                必要ポイント
                <input type="number" min="1" value="${coupon.required_points}" data-id="${coupon.coupon_id}" class="points-input">
              </label>
              <span>
                有効期限: ${
                  coupon.expires_at
                    ? new Date(coupon.expires_at).toLocaleDateString()
                    : "未設定"
                }
              </span>
            </div>
          </div>
          <div class="coupon-actions">
            <button class="delete-btn" data-id="${coupon.coupon_id}">削除</button>
          </div>
        </div>
      `
      )
      .join("");

    container.querySelectorAll(".points-input").forEach((input) => {
      input.addEventListener("change", (event) => {
        updatePoints(event.target.dataset.id, event.target.value);
      });
    });

    container.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        deleteCoupon(event.currentTarget.dataset.id);
      });
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>データの取得に失敗しました。</p>";
  }
}

async function addCoupon() {
  const title = document.getElementById("title")?.value.trim();
  const description = document.getElementById("description")?.value.trim();
  const requiredPoints = parseInt(
    document.getElementById("required_points")?.value,
    10
  );
  const expiresAt = document.getElementById("expires_at")?.value;

  if (!title || !description || !requiredPoints || !expiresAt) {
    alert("すべての項目を入力してください。");
    return;
  }

  try {
    const res = await fetch(API_BASE + "/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": CSRF_TOKEN,
      },
      body: JSON.stringify({
        title,
        description,
        required_points: requiredPoints,
        type: "common",
        expires_at: expiresAt,
      }),
    });
    if (!res.ok) throw new Error();
    document.getElementById("couponForm")?.reset();
    loadCoupons();
  } catch (err) {
    alert("クーポンの作成に失敗しました。");
  }
}

async function updatePoints(id, newPoints) {
  const parsed = parseInt(newPoints, 10);
  if (!parsed || parsed < 1) {
    alert("ポイントは1以上の数値を入力してください。");
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/${id}/update_points/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": CSRF_TOKEN,
      },
      body: JSON.stringify({ required_points: parsed }),
    });
    if (!res.ok) throw new Error();
  } catch (err) {
    alert("ポイント更新に失敗しました。");
  }
}

async function deleteCoupon(id) {
  if (!confirm("このクーポンを削除しますか？")) return;
  try {
    const res = await fetch(`${API_BASE}/${id}/delete/`, {
      method: "DELETE",
      headers: {
        "X-CSRFToken": CSRF_TOKEN,
      },
    });
    if (!res.ok) throw new Error();
    loadCoupons();
  } catch (err) {
    alert("クーポンの削除に失敗しました。");
  }
}
