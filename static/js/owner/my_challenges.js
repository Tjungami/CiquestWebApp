// C:\Users\j_tagami\CiquestWebApp\static\js\owner\my_challenges.js
document.addEventListener("DOMContentLoaded", () => {
  const qrModal = document.getElementById("qrModal");
  const qrId = document.getElementById("qrId");
  const qrCodeText = document.getElementById("qrCodeText");
  const qrCanvas = document.getElementById("qrCanvas");
  const closeBtn = document.querySelector("#qrModal .close");
  let qrInstance = null;

  const openQrModal = (id, code) => {
    qrId.textContent = id || "--";
    qrCodeText.textContent = code || "未設定";
    if (qrCanvas) {
      qrCanvas.innerHTML = "";
      if (code) {
        qrInstance = new QRCode(qrCanvas, {
          text: code,
          width: 180,
          height: 180,
        });
      }
    }
    qrModal.classList.remove("hidden");
  };

  document.querySelectorAll(".qr-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      openQrModal(btn.dataset.id, btn.dataset.qr);
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      qrModal.classList.add("hidden");
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === qrModal) {
      qrModal.classList.add("hidden");
    }
  });

  document.querySelectorAll(".delete-form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      const title = form.dataset.title || "このチャレンジ";
      if (!confirm(`${title}を削除しますか？`)) {
        event.preventDefault();
      }
    });
  });
});
