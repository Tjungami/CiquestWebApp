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
});
