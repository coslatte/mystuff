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
      "REST API for personal portfolio built with Spring Boot, JPA, Flyway and PostgreSQL. Includes authentication system.",
    tags: ["java", "springboot", "jpa", "postgresql", "flyway"],
    imageSrc: "/images/previews/cosmiclatte-api.jpg",
    githubUrl: "https://github.com/coslatte/cosmiclatte-api",
  },
  {
    title: "cosmiclatte frontend",
    category: "frontend",
    description:
      "Portfolio UI in SSR/SSG mode. Modern stack with Astro, TypeScript, Tailwind CSS v4 and Bun.",
    tags: ["astro", "typescript", "tailwindcss", "bun"],
    imageSrc: "/images/previews/cosmiclatte-frontend.jpg",
    githubUrl: "https://github.com/coslatte/cosmiclatte-frontend",
  },
  {
    title: "cosmiclatte infra",
    category: "devops",
    description:
      "Infrastructure and continuous deployment. Docker Compose configuration for local environment and CI/CD scripts for Render/Vercel.",
    tags: ["docker", "ci/cd", "devops", "bash"],
    imageSrc: "/images/previews/cosmiclatte-infra.jpg",
    githubUrl: "https://github.com/coslatte/cosmiclatte-infra",
  },
  {
    title: "audio track engine",
    category: "r&d / audio",
    description:
      "Experimental cloud audio processing engine. Research on streaming and spectral analysis.",
    tags: ["webaudioapi", "typescript", "rust", "research"],
    imageSrc: "/images/previews/audio-track-engine.jpg",
    githubUrl: "https://github.com/coslatte/audio-track-engine",
  },
];

export default projects;
