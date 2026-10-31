import { navigate } from "astro:transitions/client";

const mounted = new WeakSet<HTMLElement>();

export function mountMusicViews() {
  const root = document.querySelector<HTMLElement>("[data-music-views]");
  if (!root || mounted.has(root)) return;
  mounted.add(root);
  const navigation = root.querySelector(".music-view-switch");
  const tabs = [...root.querySelectorAll<HTMLAnchorElement>("[data-music-view]")];
  const panels = [...root.querySelectorAll<HTMLElement>("[data-music-panel]")];
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  navigation?.setAttribute("role", "tablist");
  tabs.forEach(tab => {
    tab.setAttribute("role", "tab");
    const panel = panels.find(panel => panel.dataset.musicPanel === tab.dataset.musicView);
    if (panel) {
      tab.setAttribute("aria-controls", panel.id);
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tab.id);
      panel.tabIndex = 0;
    }
  });

  const select = () => {
    const journey = location.hash === "#music-journey" || location.hash === "#journey-today";
    const view = journey ? "journey" : "listen";
    tabs.forEach(tab => {
      const active = tab.dataset.musicView === view;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach(panel => { panel.hidden = panel.dataset.musicPanel !== view; });
    root.dispatchEvent(new Event("music:view-change"));
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", async event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      await navigate(tab.href);
      select();
      root.scrollIntoView({ block: "start", behavior: "instant" });
    }, { signal });
    tab.addEventListener("keydown", event => {
      let next: HTMLAnchorElement | undefined;
      if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
      if (event.key === "ArrowLeft") next = tabs[(index + tabs.length - 1) % tabs.length];
      if (event.key === "Home") next = tabs[0];
      if (event.key === "End") next = tabs[tabs.length - 1];
      if (!next) return;
      event.preventDefault();
      next.click();
      next.focus({ preventScroll: true });
    }, { signal });
  });
  window.addEventListener("hashchange", select, { signal });
  window.addEventListener("popstate", select, { signal });
  document.addEventListener("astro:before-swap", () => lifecycle.abort(), { once: true, signal });
  select();
}
