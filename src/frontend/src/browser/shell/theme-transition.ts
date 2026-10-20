const COVER_MS = 180;
const REVEAL_MS = 240;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const BAYER_2 = [0, 2, 3, 1];

export function transitionTheme({ applyTheme, onFinish }: {
  applyTheme: () => void;
  onFinish: () => void;
}): () => void {
  const root = document.documentElement;
  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  if (preference.matches || document.hidden || root.matches("[data-boot-pending], .route-locked")) {
    applyTheme();
    onFinish();
    return () => {};
  }

  const canvas = document.createElement("canvas");
  canvas.className = "theme-curtain";
  canvas.setAttribute("aria-hidden", "true");
  const cell = Math.max(6, Math.ceil(Math.sqrt(innerWidth * innerHeight / 100_000)));
  canvas.width = Math.ceil(innerWidth / cell);
  canvas.height = Math.ceil(innerHeight / cell);
  canvas.style.width = `${canvas.width * cell}px`;
  canvas.style.height = `${canvas.height * cell}px`;

  let frame = 0;
  let deadline = 0;
  let applied = false;
  let finished = false;
  const listeners = new AbortController();

  function commit(): void {
    if (applied) return;
    applied = true;
    applyTheme();
  }

  function finish(): void {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    clearTimeout(deadline);
    listeners.abort();
    try {
      commit();
    } finally {
      canvas.remove();
      delete root.dataset.themeTransition;
      onFinish();
    }
  }

  try {
    const context = canvas.getContext("2d");
    if (!context) {
      finish();
      return finish;
    }
    context.fillStyle = getComputedStyle(document.body).backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const ranks = new Uint8Array(canvas.width * canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        // Nested Bayer ranks give 64 density steps while keeping the same pattern each frame.
        ranks[y * canvas.width + x] = 4 * BAYER[(y % 4) * 4 + x % 4]
          + BAYER_2[(Math.floor(y / 4) % 2) * 2 + Math.floor(x / 4) % 2];
      }
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    document.body.append(canvas);
    root.dataset.themeTransition = "covering";
    const started = performance.now();
    let revealedAt: number | null = null;
    let lastStep = -1;

    const paint = (now: number): void => {
      try {
        const covering = revealedAt === null;
        const progress = revealedAt === null ? (now - started) / COVER_MS : (now - revealedAt) / REVEAL_MS;
        const step = Math.min(64, Math.floor(progress * 64));
        if (step !== lastStep) {
          for (let i = 0; i < ranks.length; i++) {
            image.data[i * 4 + 3] = (covering ? ranks[i] < step : ranks[i] >= step) ? 255 : 0;
          }
          context.putImageData(image, 0, 0);
          lastStep = step;
        }
        if (progress >= 1) {
          if (covering) {
            commit();
            root.dataset.themeTransition = "revealing";
            revealedAt = now;
            lastStep = -1;
          } else {
            finish();
            return;
          }
        }
        frame = requestAnimationFrame(paint);
      } catch {
        finish();
      }
    };

    const options = { signal: listeners.signal };
    window.addEventListener("resize", finish, options);
    window.visualViewport?.addEventListener("resize", finish, options);
    window.addEventListener("pagehide", finish, options);
    document.addEventListener("visibilitychange", finish, options);
    document.addEventListener("astro:before-preparation", finish, options);
    preference.addEventListener("change", finish, options);
    deadline = window.setTimeout(finish, 1500);
    frame = requestAnimationFrame(paint);
  } catch {
    finish();
  }
  return finish;
}
