import { isLocale, translate } from "./i18n";
import { getLocale, restoreLocale, setLocale, subscribeLocale } from "../services/locale";

const originals = new WeakMap<Node, { source: string; rendered: string }>();
const attributes = new WeakMap<Element, Map<string, { source: string; rendered: string }>>();
const ignored = 'astro-island, script, style, pre, code, textarea, [translate="no"], [contenteditable]';
const localizedAttributes = ["aria-label", "aria-valuetext", "title", "placeholder", "alt", "data-tip"];
let initialized = false;

function localize(root: Node) {
  if (root instanceof Element && root.closest(ignored)) return;
  if (root instanceof Text) {
    if (root.parentElement?.closest(ignored)) return;
    const current = root.data;
    const previous = originals.get(root);
    const source = previous?.rendered === current ? previous.source : current;
    const rendered = translate(source, getLocale());
    originals.set(root, { source, rendered });
    if (current !== rendered) root.data = rendered;
    return;
  }
  if (root instanceof Element) {
    const stored = attributes.get(root) ?? new Map();
    for (const name of localizedAttributes) {
      const current = root.getAttribute(name);
      if (current === null) continue;
      const previous = stored.get(name);
      const source = previous?.rendered === current ? previous.source : current;
      const rendered = translate(source, getLocale());
      stored.set(name, { source, rendered });
      if (current !== rendered) root.setAttribute(name, rendered);
    }
    attributes.set(root, stored);
  }
  root.childNodes.forEach(localize);
}

export function initLocalization() {
  if (initialized) return;
  initialized = true;
  restoreLocale();
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "childList") record.addedNodes.forEach(localize);
      else localize(record.target);
    }
  });
  function render() {
    observer.disconnect();
    document.documentElement.lang = getLocale();
    localize(document.head);
    localize(document.body);
    document.querySelectorAll<HTMLSelectElement>("[data-language-select]").forEach(select => {
      select.value = getLocale();
      select.disabled = false;
    });
    observer.observe(document.body, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: localizedAttributes,
    });
  }
  subscribeLocale(render);
  document.addEventListener("change", event => {
    const select = event.target;
    if (select instanceof HTMLSelectElement && select.matches("[data-language-select]") && isLocale(select.value)) {
      setLocale(select.value);
    }
  });
  document.addEventListener("astro:after-swap", render);
  document.addEventListener("astro:page-load", render);
  render();
}
