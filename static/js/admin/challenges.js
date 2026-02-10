const API_BASE = "/operator/api/challenges";
const CSRF_TOKEN = getCsrfToken();

document.addEventListener("DOMContentLoaded", () => {
  const searchBtn = document.getElementById("searchBtn");
  const searchInput = document.getElementById("searchInput");

  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", () => {
      loadChallenges(searchInput.value.trim());
    });

    searchInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        loadChallenges(searchInput.value.trim());
      }
    });
  }

  loadChallenges();
});

function getCsrfToken() {
  const value = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("csrftoken="));
  return value ? decodeURIComponent(value.split("=")[1]) : "";
}

async function loadChallenges(keyword = "") {
  const container = document.getElementById("challengeList");
  if (!container) return;
  container.innerHTML = "<p>読み込み中です...</p>";

  try {
    const url = `${API_BASE}/?search=${encodeURIComponent(keyword)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = "<p>該当するチャレンジがありません。</p>";
      return;
    }

    container.innerHTML = data
      .map(
        (ch) => `
        <div class="challenge-card">
          <div class="challenge-info">
            <strong>${ch.title}</strong><br>
            店舗: ${ch.store_name || "店舗未設定"}<br>
            報酬ポイント: ${ch.reward_points} pt
            ${ch.is_banned ? "<span class='banned-label'>BAN中</span>" : ""}
          </div>
          <div>
            ${
              ch.is_banned
                ? ""
                : `<button class="ban-btn" data-challenge="${ch.challenge_id}">BAN</button>`
            }
          </div>
        </div>
      `
      )
      .join("");

    container.querySelectorAll(".ban-btn").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const id = event.currentTarget.dataset.challenge;
        banChallenge(id, keyword);
      });
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>データの取得に失敗しました。</p>";
  }
}

async function banChallenge(id, keyword) {
  if (!confirm("このチャレンジをBANしますか？")) return;
  try {
    const res = await fetch(`${API_BASE}/${id}/ban/`, {
      method: "POST",
      headers: {
        "X-CSRFToken": CSRF_TOKEN,
      },
    });
    if (!res.ok) throw new Error();
    loadChallenges(keyword);
  } catch (err) {
    alert("BANに失敗しました。");
  }
}
