import { messages } from "./i18n/catalog";
import { musicJourneyCopy } from "../data/music-journey-copy";

export type MusicJourneyChapter = {
  copy: (typeof musicJourneyCopy.chapters)[number];
  artists: readonly (readonly [string, string])[];
  milestone?: boolean;
  link?: string;
};

export type MusicJourneyPeriod =
  | typeof messages.music.sharedBeginnings
  | typeof messages.music.adolescenceParallelPaths
  | typeof messages.music.overlappingDiscoveries
  | typeof messages.music.turningPoint
  | typeof messages.music.fromListeningToPlaying
  | typeof messages.music.pathsDrawCloser;

export type MusicJourneyMoment = {
  period: MusicJourneyPeriod;
  shared?: MusicJourneyChapter;
  root?: MusicJourneyChapter;
  discovery?: MusicJourneyChapter;
};

// Structural description of the journey's moments: which artists sit on which
// lane, which chapters are milestones, and which carry an external link. The
// editorial copy itself lives in `data/music-journey-copy.ts`; periods use the
// generated message references so they stay type-safe and translatable.
export const musicJourneyMoments: MusicJourneyMoment[] = [
  {
    period: messages.music.sharedBeginnings,
    shared: {
      copy: musicJourneyCopy.chapters[0],
      artists: [["skrillex", "Skrillex"]],
    },
  },
  {
    period: messages.music.adolescenceParallelPaths,
    shared: {
      copy: musicJourneyCopy.chapters[1],
      artists: [["linkin-park", "Linkin Park"]],
    },
  },
  {
    period: messages.music.overlappingDiscoveries,
    root: {
      copy: musicJourneyCopy.chapters[2],
      artists: [["chime", "Chime"]],
    },
    discovery: {
      copy: musicJourneyCopy.chapters[3],
      artists: [["joji", "Joji"]],
    },
  },
  {
    period: messages.music.turningPoint,
    discovery: {
      copy: musicJourneyCopy.chapters[4],
      artists: [["jacob-collier", "Jacob Collier"]],
      milestone: true,
      link: "https://www.youtube.com/watch?v=VPLCk-FTVvw",
    },
  },
  {
    period: messages.music.fromListeningToPlaying,
    discovery: {
      copy: musicJourneyCopy.chapters[5],
      artists: [["keith-jarrett", "Keith Jarrett"]],
      milestone: true,
    },
  },
  {
    period: messages.music.pathsDrawCloser,
    discovery: {
      copy: musicJourneyCopy.chapters[6],
      artists: [["opn", "Oneohtrix Point Never"], ["cubalibre-exe", "cubalibre.exe"], ["sakamoto", "Ryuichi Sakamoto"]],
    },
  },
];
