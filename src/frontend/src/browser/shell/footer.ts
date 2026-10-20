function setContactOrigin(event: PointerEvent): void {
  if (event.pointerType === "touch" || !(event.target instanceof Element)) return;
  const link = event.target.closest<HTMLElement>(".footer-contact");
  if (!link || link.contains(event.relatedTarget as Node | null)) return;

  const rect = link.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  link.style.setProperty("--contact-origin", `${x}% ${y}%`);
}

function syncFooter(): void {
  document.querySelectorAll<HTMLElement>("footer[data-collapsed]").forEach((footer) => {
    footer.style.transform = "translateY(calc(100% - 0.5rem))";
  });
}

function togglePlayer(event: MouseEvent): void {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLButtonElement>("[data-footer-toggle]");
  if (!button) return;

  const footer = button.closest("footer");
  if (!footer) return;

  const collapsed = footer.toggleAttribute("data-collapsed");
  button.setAttribute("aria-expanded", String(!collapsed));
  button.setAttribute("aria-label", collapsed ? "show player" : "hide player");
  button.querySelector("span")!.textContent = collapsed ? "↑" : "↓";
  footer.style.transform = collapsed ? "translateY(calc(100% - 0.5rem))" : "translateY(0)";
}

function jumpPage(event: MouseEvent): void {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest<HTMLAnchorElement>("[data-page-jump]");
  const swipe = document.querySelector<HTMLElement>("[data-page-jump-swipe]");
  if (!link || !swipe || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  event.preventDefault();
  const direction = link.dataset.pageJump === "up" ? "up" : "down";
  const target = document.querySelector<HTMLElement>(link.hash);
  if (!target) return;
  const distance = Math.abs(target.getBoundingClientRect().top);
  const duration = Math.min(2000, Math.max(120, distance * 0.18));
  delete swipe.dataset.active;
  void swipe.offsetWidth;
  swipe.dataset.direction = direction;
  swipe.style.setProperty("--jump-duration", `${duration}ms`);
  swipe.dataset.active = "";
  window.setTimeout(() => {
    const root = document.documentElement;
    root.dataset.pageJumpInstant = "";
    target.scrollIntoView({ behavior: "auto" });
    requestAnimationFrame(() => requestAnimationFrame(() => delete root.dataset.pageJumpInstant));
  }, duration / 2);
  window.setTimeout(() => {
    delete swipe.dataset.active;
    swipe.style.removeProperty("--jump-duration");
  }, duration);
}

document.addEventListener("pointerover", setContactOrigin);
document.addEventListener("click", togglePlayer);
document.addEventListener("click", jumpPage);
document.addEventListener("astro:page-load", syncFooter);
