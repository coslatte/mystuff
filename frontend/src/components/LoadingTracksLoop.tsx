import { useEffect, useRef, useState } from "react";
import LoadingTracks from "./LoadingTracks";

/** 4x: one fake second per tick, so a 25s cold start plays in about six seconds. */
const SPEED = 4;
const TICK_MS = 250;
/** `LoadingTracks` switches to "almost there" at 25 and stays there while it waits. */
const ALMOST_AT = 25;
/** How long the two closing stages stay up, so neither is a single frame. */
const HOLD_MS = 1500;

type Stage = "running" | "almost" | "ready";

type Walk = {
  stage: Stage;
  elapsed: number;
};

function advance(walk: Walk): Walk {
  if (walk.stage === "ready") return { stage: "running", elapsed: 0 };
  if (walk.stage === "almost") return { stage: "ready", elapsed: ALMOST_AT + 1 };
  const elapsed = Math.round(walk.elapsed + (SPEED * TICK_MS) / 1000);
  return elapsed >= ALMOST_AT ? { stage: "almost", elapsed } : { stage: "running", elapsed };
}

/**
 * `/loading` only: walks the ribbon through every stage on a compressed clock, so
 * the whole cold start can be watched without waiting for one.
 */
export default function LoadingTracksLoop() {
  const [walk, setWalk] = useState<Walk>({ stage: "running", elapsed: 0 });
  // The walk owns the schedule, because the pause after a step depends on the stage
  // that step produced and an updater cannot report back.
  const current = useRef(walk);

  useEffect(() => {
    let timer = 0;
    const step = () => {
      current.current = advance(current.current);
      setWalk(current.current);
      const hold = current.current.stage !== "running";
      timer = window.setTimeout(step, hold ? HOLD_MS : TICK_MS);
    };
    timer = window.setTimeout(step, TICK_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return <LoadingTracks serverReady={walk.stage === "ready"} elapsed={walk.elapsed} />;
}