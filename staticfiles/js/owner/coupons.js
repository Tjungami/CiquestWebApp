// C:\Users\j_tagami\CiquestWebApp\static\js\owner\coupons.js
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".delete-form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      const title = form.dataset.title || "このクーポン";
      if (!confirm(`${title}を削除しますか？`)) {
        event.preventDefault();
      }
    });
  });
});
