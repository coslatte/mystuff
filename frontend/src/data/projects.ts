export type Project = {
  title: string;
  category: string;
  description: string;
  tags: string[];
  imageSrc: string;
  demoUrl?: string;
  githubUrl?: string;
};

const projects: Project[] = [
  {
    title: "cosmiclatte api",
    category: "backend",
    description:
      "api rest para portafolio personal construida con spring boot, jpa, flyway y postgresql. incluye sistema de autenticación.",
    tags: ["java", "springboot", "jpa", "postgresql", "flyway"],
    imageSrc: "/images/previews/cosmiclatte-api.jpg",
    githubUrl: "https://github.com/coslatte/cosmiclatte-api",
  },
  {
    title: "cosmiclatte frontend",
    category: "frontend",
    description:
      "interfaz de usuario del portafolio en modo ssr/ssg. stack moderno con astro, typescript, tailwind css v4 y bun.",
    tags: ["astro", "typescript", "tailwindcss", "bun"],
    imageSrc: "/images/previews/cosmiclatte-frontend.jpg",
    githubUrl: "https://github.com/coslatte/cosmiclatte-frontend",
  },
  {
    title: "cosmiclatte infra",
    category: "devops",
    description:
      "infraestructura y despliegue continuo. configuración de docker-compose para entorno local y scripts de ci/cd para render/vercel.",
    tags: ["docker", "ci/cd", "devops", "bash"],
    imageSrc: "/images/previews/cosmiclatte-infra.jpg",
    githubUrl: "https://github.com/coslatte/cosmiclatte-infra",
  },
  {
    title: "audio track engine",
    category: "r&d / audio",
    description:
      "motor de procesamiento de audio experimental en la nube. investigación sobre streaming y análisis espectral.",
    tags: ["webaudioapi", "typescript", "rust", "research"],
    imageSrc: "/images/previews/audio-track-engine.jpg",
    githubUrl: "https://github.com/coslatte/audio-track-engine",
  },
];

export default projects;
