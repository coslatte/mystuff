import { startBootScreen, type BootReplay } from "./boot-controller";

const SCHEDULE: BootReplay["milestones"] = [
  ["painted", 0],
  ["dom", 500],
  ["fonts", 1900],
  ["islands", 3800],
  ["assets", 6200],
];

const GAP_MS = 1400;
const counter = document.querySelector("[data-replay-cycle]");
let cycles = 0;
let restart = 0;

function run(): void {
  startBootScreen({
    replay: {
      milestones: SCHEDULE,
      onExit: () => {
        cycles += 1;
        if (counter) counter.textContent = String(cycles);
        restart = window.setTimeout(run, GAP_MS);
      },
    },
  });
}

document.addEventListener("astro:before-swap", () => window.clearTimeout(restart), {
  once: true,
});

run();
