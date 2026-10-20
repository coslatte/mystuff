import { musicJourneyCopy } from "../../data/music-journey-copy";

export const journeyTranslations = [
  musicJourneyCopy.title,
  musicJourneyCopy.subtitle,
  ...musicJourneyCopy.intro,
  ...musicJourneyCopy.chapters.flatMap((chapter) => [chapter.title, ...chapter.paragraphs]),
  ["03 / influences", "03 / influencias"],
  ["roots", "raices"],
  ["musical expansion", "expansión musical"],
  ["roots", "raices"],
  ["Musical expansion", "Expansión musical"],
  ["the beginning", "primeros descubrimientos"],
  ["adolescence & parallel paths", "adolescencia y caminos paralelos"],
  ["pandemic, university and later evolution", "pandemia, universidad y evolución musical"],
  ["a turning point", "punto de inflexión"],
  ["From listening to playing", "De escuchar a tocar"],
  ["Recent discoveries / the paths draw closer", "Descubrimientos recientes / los caminos se acercan"],
  ["Both paths / now", "Ambos caminos / presente"],
  ["Artist photography credits ↗", "Créditos de las fotografías ↗"],
] as const;
