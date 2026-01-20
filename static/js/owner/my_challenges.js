// C:\Users\j_tagami\CiquestWebApp\static\js\owner\my_challenges.js
document.addEventListener("DOMContentLoaded", () => {
  const qrModal = document.getElementById("qrModal");
  const qrCanvas = document.getElementById("qrCanvas");
  const qrCopyBtn = document.getElementById("qrCopyBtn");
  const qrCopyImageBtn = document.getElementById("qrCopyImageBtn");
  const qrDownloadBtn = document.getElementById("qrDownloadBtn");
  const qrPrintBtn = document.getElementById("qrPrintBtn");
  const qrStatus = document.getElementById("qrStatus");
  const closeBtn = document.querySelector("#qrModal .close");
  let qrInstance = null;
  let currentId = "--";
  let currentCode = "";

  const setStatus = (message) => {
    if (qrStatus) {
      qrStatus.textContent = message || "";
    }
  };

  const copyText = async (text) => {
    if (!text) return false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const temp = document.createElement("textarea");
    temp.value = text;
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(temp);
    return ok;
  };

  const getQrDataUrl = () => {
    if (!qrCanvas) return "";
    const canvas = qrCanvas.querySelector("canvas");
    if (canvas && canvas.toDataURL) {
      return canvas.toDataURL("image/png");
    }
    const img = qrCanvas.querySelector("img");
    return img ? img.src : "";
  };

  const downloadPng = (dataUrl, filename) => {
    if (!dataUrl) return false;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename || "qr-code.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  };

  const copyImage = async (dataUrl) => {
    if (!dataUrl) return false;
    if (!navigator.clipboard || !window.ClipboardItem) return false;
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const item = new ClipboardItem({ [blob.type]: blob });
    await navigator.clipboard.write([item]);
    return true;
  };

  const openPrintWindow = (id, code) => {
    const imgSrc = getQrDataUrl();
    if (!imgSrc) return false;
    const printWindow = window.open("", "_blank", "width=600,height=800");
    if (!printWindow) return false;
    printWindow.document.write(
      `<!doctype html><html><head><title>QR印刷</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 24px; }
        img { width: 260px; height: 260px; }
        .meta { margin-top: 12px; color: #333; }
      </style>
      </head><body>
        <h2>チャレンジQR</h2>
        <img src="${imgSrc}" alt="QR code">
        <div class="meta">ID: ${id || "--"}</div>
        <div class="meta">コード: ${code || "--"}</div>
      </body></html>`
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
    return true;
  };

  const openQrModal = (id, code) => {
    currentId = id || "--";
    currentCode = code || "";
    setStatus("");
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

  if (qrCopyBtn) {
    qrCopyBtn.addEventListener("click", async () => {
      try {
        const ok = await copyText(currentCode);
        setStatus(ok ? "コピーしました。" : "コピーに失敗しました。");
      } catch (error) {
        setStatus("コピーに失敗しました。");
      }
    });
  }

  if (qrPrintBtn) {
    qrPrintBtn.addEventListener("click", () => {
      const ok = openPrintWindow(currentId, currentCode);
      if (!ok) {
        setStatus("印刷に失敗しました。");
      }
    });
  }

  if (qrDownloadBtn) {
    qrDownloadBtn.addEventListener("click", () => {
      const ok = downloadPng(getQrDataUrl(), "challenge-qr.png");
      if (!ok) {
        setStatus("保存に失敗しました。");
      }
    });
  }

  if (qrCopyImageBtn) {
    qrCopyImageBtn.addEventListener("click", async () => {
      try {
        const ok = await copyImage(getQrDataUrl());
        setStatus(ok ? "画像をコピーしました。" : "画像コピーに失敗しました。");
      } catch (error) {
        setStatus("画像コピーに失敗しました。");
      }
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
      if (!confirm(`「${title}」を削除しますか？`)) {
        event.preventDefault();
      }
    });
  });
});
