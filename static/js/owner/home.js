// C:\Users\j_tagami\CiquestWebApp\static\js\owner\home.js
document.addEventListener("DOMContentLoaded", () => {
  const qrContainer = document.getElementById("storeQRCode");
  if (!qrContainer) return;

  const qrData = qrContainer.dataset.qr;
  if (!qrData) return;

  new QRCode(qrContainer, {
    text: qrData,
    width: 200,
    height: 200,
  });

  const copyBtn = document.getElementById("storeQrCopyBtn");
  const printBtn = document.getElementById("storeQrPrintBtn");
  const statusEl = document.getElementById("storeQrStatus");

  const setStatus = (message) => {
    if (statusEl) {
      statusEl.textContent = message || "";
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
    const canvas = qrContainer.querySelector("canvas");
    if (canvas && canvas.toDataURL) {
      return canvas.toDataURL("image/png");
    }
    const img = qrContainer.querySelector("img");
    return img ? img.src : "";
  };

  const openPrintWindow = (code) => {
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
        <h2>店舗QR</h2>
        <img src="${imgSrc}" alt="QR code">
        <div class="meta">コード: ${code || "--"}</div>
      </body></html>`
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
    return true;
  };

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        const ok = await copyText(qrData);
        setStatus(ok ? "コピーしました。" : "コピーに失敗しました。");
      } catch (error) {
        setStatus("コピーに失敗しました。");
      }
    });
  }

  if (printBtn) {
    printBtn.addEventListener("click", () => {
      const ok = openPrintWindow(qrData);
      if (!ok) {
        setStatus("印刷に失敗しました。");
      }
    });
  }
});
