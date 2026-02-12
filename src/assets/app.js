const modal = document.querySelector("[data-video-modal]");
const iframe = modal?.querySelector("iframe");
const titleEl = modal?.querySelector("[data-video-title]");
const closeBtn = modal?.querySelector("[data-video-close]");

const openModal = (title, vimeoId) => {
  if (!modal || !iframe) return;
  const src = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&title=0&byline=0&portrait=0`;
  iframe.setAttribute("src", src);
  iframe.setAttribute("title", title);
  if (titleEl) titleEl.textContent = title;
  modal.setAttribute("data-open", "true");
  document.body.style.overflow = "hidden";
};

const closeModal = () => {
  if (!modal || !iframe) return;
  modal.setAttribute("data-open", "false");
  iframe.setAttribute("src", "");
  document.body.style.overflow = "";
};

closeBtn?.addEventListener("click", closeModal);
modal?.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});

document.querySelectorAll("[data-vimeo-id]").forEach((card) => {
  card.addEventListener("click", () => {
    const title = card.getAttribute("data-title") || "Video";
    const vimeoId = card.getAttribute("data-vimeo-id");
    if (!vimeoId) return;
    openModal(title, vimeoId);
  });
});
