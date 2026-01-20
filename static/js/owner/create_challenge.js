// C:\Users\j_tagami\CiquestWebApp\static\js\owner\create_challenge.js
// --- オーナー用チャレンジ作成フォーム制御 ---

function toggleRewardFields() {
  const questType = document.getElementById("quest_type").value;
  const commonReward = document.getElementById("commonReward");
  const storeSpecificReward = document.getElementById("storeSpecificReward");
  const rewardType = document.getElementById("reward_type");

  if (questType === "common") {
    commonReward.classList.remove("hidden");
    storeSpecificReward.classList.add("hidden");
    if (rewardType) {
      const pointsOption = rewardType.querySelector('option[value="points"]');
      if (pointsOption) {
        pointsOption.disabled = false;
        pointsOption.hidden = false;
      }
    }
  } else {
    commonReward.classList.add("hidden");
    storeSpecificReward.classList.remove("hidden");
    if (rewardType) {
      const pointsOption = rewardType.querySelector('option[value="points"]');
      if (pointsOption) {
        pointsOption.disabled = true;
        pointsOption.hidden = true;
      }
      if (rewardType.value === "points") {
        const fallback = rewardType.querySelector('option[value="coupon"]') || rewardType.querySelector('option[value="service"]');
        if (fallback) {
          rewardType.value = fallback.value;
        }
      }
    }
  }
}

function toggleRewardDetail() {
  const rewardType = document.getElementById("reward_type").value;
  const couponSection = document.getElementById("reward_coupon");
  const serviceSection = document.getElementById("reward_service");

  couponSection.classList.toggle("hidden", rewardType !== "coupon");
  serviceSection.classList.toggle("hidden", rewardType !== "service");
}

// --- リセットボタンの確認アラート ---
function confirmReset(event) {
  const confirmResult = confirm("フォームの内容をすべてリセットします。よろしいですか？");
  if (!confirmResult) {
    event.preventDefault(); // リセット処理を止める
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // クエストタイプ切り替え
  const questTypeField = document.getElementById("quest_type");
  if (questTypeField) {
    questTypeField.addEventListener("change", toggleRewardFields);
  }

  // 報酬タイプ切り替え
  const rewardType = document.getElementById("reward_type");
  if (rewardType) {
    rewardType.addEventListener("change", toggleRewardDetail);
  }

  // リセットボタンに確認アラート追加
  const resetBtn = document.querySelector("button[type='reset']");
  if (resetBtn) {
    resetBtn.addEventListener("click", confirmReset);
  }

  // 初期表示調整
  if (questTypeField) {
    toggleRewardFields();
  }
  if (rewardType) {
    toggleRewardDetail();
  }
});
