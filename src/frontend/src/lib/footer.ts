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

document.addEventListener("pointerover", setContactOrigin);
document.addEventListener("click", togglePlayer);
document.addEventListener("astro:page-load", syncFooter);
