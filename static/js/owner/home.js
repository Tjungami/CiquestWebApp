// C:\Users\j_tagami\CiquestWebApp\static\js\owner\home.js
document.addEventListener("DOMContentLoaded", () => {
  const qrContainer = document.getElementById("storeQRCode");
  if (!qrContainer) return;

  const qrData = qrContainer.dataset.qr;
  // 空文字列もチェック
  if (!qrData || qrData.trim() === "") {
    return;
  }

  // QRCodeライブラリの存在チェック
  if (typeof QRCode === "undefined") {
    setStatus("QRコードライブラリの読み込みに失敗しました。");
    return;
  }

  let qrInstance = null;
  try {
    qrInstance = new QRCode(qrContainer, {
      text: qrData,
      width: 200,
      height: 200,
    });
  } catch (error) {
    setStatus("QRコードの生成に失敗しました。");
    return;
  }

  const copyBtn = document.getElementById("storeQrCopyBtn");
  const copyImageBtn = document.getElementById("storeQrCopyImageBtn");
  const downloadBtn = document.getElementById("storeQrDownloadBtn");
  const printBtn = document.getElementById("storeQrPrintBtn");
  const statusEl = document.getElementById("storeQrStatus");

  // 処理中フラグ（連続クリック防止）
  let isProcessing = false;

  const setStatus = (message) => {
    if (statusEl) {
      statusEl.textContent = message || "";
    }
  };

  // data URLかどうかをチェック
  const isValidDataUrl = (url) => {
    return url && typeof url === "string" && url.startsWith("data:");
  };

  const copyText = async (text) => {
    if (!text || text.trim() === "") return false;
    
    try {
      // Clipboard APIを優先
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      // fallbackに続行
    }

    // fallback: execCommand（非推奨だが互換性のため）
    try {
      const temp = document.createElement("textarea");
      temp.value = text;
      temp.style.position = "fixed";
      temp.style.opacity = "0";
      temp.style.left = "-9999px";
      document.body.appendChild(temp);
      temp.select();
      temp.setSelectionRange(0, 99999); // モバイル対応
      
      const ok = document.execCommand("copy");
      document.body.removeChild(temp);
      return ok;
    } catch (error) {
      return false;
    }
  };

  const getQrDataUrl = () => {
    try {
      const canvas = qrContainer.querySelector("canvas");
      if (canvas && canvas.toDataURL) {
        const dataUrl = canvas.toDataURL("image/png");
        if (isValidDataUrl(dataUrl)) {
          return dataUrl;
        }
      }
      
      const img = qrContainer.querySelector("img");
      if (img && img.src) {
        // data URLか外部URLかをチェック
        if (isValidDataUrl(img.src)) {
          return img.src;
        }
      }
      
      return "";
    } catch (error) {
      return "";
    }
  };

  const downloadPng = (dataUrl, filename) => {
    if (!dataUrl || !isValidDataUrl(dataUrl)) {
      return false;
    }
    
    try {
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = filename || "qr-code.png";
      document.body.appendChild(link);
      link.click();
      // 少し遅延してから削除（一部ブラウザで必要）
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
      return true;
    } catch (error) {
      return false;
    }
  };

  const copyImage = async (dataUrl) => {
    if (!dataUrl || !isValidDataUrl(dataUrl)) {
      return false;
    }
    
    if (!navigator.clipboard || !window.ClipboardItem) {
      return false;
    }

    try {
      const response = await fetch(dataUrl);
      if (!response.ok) {
        return false;
      }
      
      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        return false;
      }
      
      const item = new ClipboardItem({ [blob.type || "image/png"]: blob });
      await navigator.clipboard.write([item]);
      return true;
    } catch (error) {
      return false;
    }
  };

  const openPrintWindow = (code) => {
    const imgSrc = getQrDataUrl();
    if (!imgSrc || !isValidDataUrl(imgSrc)) {
      return false;
    }
    
    try {
      const printWindow = window.open("", "_blank", "width=600,height=800");
      if (!printWindow) {
        return false;
      }

      // XSS対策: codeをエスケープ
      const escapedCode = String(code || "--")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");

      printWindow.document.write(
        `<!doctype html><html><head><title>QR印刷</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 24px; }
          img { width: 260px; height: 260px; }
          .meta { margin-top: 12px; color: #333; }
        </style>
        </head><body>
          <h2>店舗QR</h2>
          <img src="${imgSrc.replace(/"/g, "&quot;")}" alt="QR code">
          <div class="meta">コード: ${escapedCode}</div>
        </body></html>`
      );
      printWindow.document.close();
      
      // 画像の読み込みを待つ
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        // 印刷ダイアログが閉じられるまで待ってからウィンドウを閉じる
        // 注意: print()は非同期なので、実際のタイミングはブラウザ依存
        setTimeout(() => {
          // ユーザーが印刷ダイアログを閉じた後も少し待つ
          if (!printWindow.closed) {
            printWindow.close();
          }
        }, 1000);
      };
      
      return true;
    } catch (error) {
      return false;
    }
  };

  // ボタンクリックハンドラ（連続クリック防止付き）
  const withProcessingGuard = (handler) => {
    return async (...args) => {
      if (isProcessing) {
        return;
      }
      
      isProcessing = true;
      try {
        await handler(...args);
      } finally {
        // 少し遅延してからフラグを解除（連続クリックを防ぐ）
        setTimeout(() => {
          isProcessing = false;
        }, 300);
      }
    };
  };

  if (copyBtn) {
    copyBtn.addEventListener("click", withProcessingGuard(async () => {
      try {
        const ok = await copyText(qrData);
        setStatus(ok ? "コピーしました。" : "コピーに失敗しました。");
      } catch (error) {
        setStatus("コピーに失敗しました。");
      }
    }));
  }

  if (printBtn) {
    printBtn.addEventListener("click", withProcessingGuard(() => {
      const ok = openPrintWindow(qrData);
      if (!ok) {
        setStatus("印刷に失敗しました。");
      }
    }));
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", withProcessingGuard(() => {
      const ok = downloadPng(getQrDataUrl(), "store-qr.png");
      if (!ok) {
        setStatus("保存に失敗しました。");
      }
    }));
  }

  if (copyImageBtn) {
    copyImageBtn.addEventListener("click", withProcessingGuard(async () => {
      try {
        const ok = await copyImage(getQrDataUrl());
        setStatus(ok ? "画像をコピーしました。" : "画像コピーに失敗しました。");
      } catch (error) {
        setStatus("画像コピーに失敗しました。");
      }
    }));
  }
});
