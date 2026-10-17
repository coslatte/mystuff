import { musicJourneyCopy } from "../music-journey-copy";

export const journeyTranslations = [
  musicJourneyCopy.title,
  musicJourneyCopy.subtitle,
  ...musicJourneyCopy.intro,
  ...musicJourneyCopy.chapters.flatMap((chapter) => [chapter.title, ...chapter.paragraphs]),
  ["03 / influences", "03 / influencias"],
  ["Electronic root / continuous", "Raíz electrónica / continua"],
  ["Musical expansion / discoveries", "Expansión musical / descubrimientos"],
  ["Electronic root", "Raíz electrónica"],
  ["Musical expansion", "Expansión musical"],
  ["Shared beginnings", "Los primeros descubrimientos"],
  ["Adolescence / parallel paths", "Adolescencia / caminos paralelos"],
  ["Pandemic, university and after / overlapping discoveries", "Pandemia, universidad y después / descubrimientos en paralelo"],
  ["A turning point / the electronic thread continues", "Un punto de inflexión / la electrónica continúa"],
  ["From listening to playing", "De escuchar a tocar"],
  ["Recent discoveries / the paths draw closer", "Descubrimientos recientes / los caminos se acercan"],
  ["Both paths / now", "Ambos caminos / presente"],
  ["Listen to Moon River ↗", "Escuchar Moon River ↗"],
  ["Artist photography credits ↗", "Créditos de las fotografías ↗"],
] as const;
