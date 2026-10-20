import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const normalize = value => value.replaceAll("\\", "/");
async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : [file];
  }))).flat();
}

const files = await sourceFiles(root);
const known = new Set(files);
const failures = [];
const graph = new Map();
const clientRoots = new Set();
const allowed = {
  pages: ["layouts", "components", "services", "lib", "data", "types"],
  layouts: ["components", "styles"],
  components: ["components", "hooks", "browser", "services", "lib", "data", "types", "styles"],
  browser: ["browser", "services", "lib", "data", "types", "styles"],
  hooks: ["hooks", "services", "lib", "data", "types"],
  services: ["services", "lib", "data", "types"],
  lib: ["lib", "data", "types"],
  data: ["data", "types"],
  types: ["types"],
};
const browserGlobals = new Set(["window", "document", "navigator", "localStorage", "sessionStorage", "requestAnimationFrame", "cancelAnimationFrame", "MutationObserver", "ResizeObserver", "fetch"]);
const relative = file => normalize(path.relative(root, file));
const layer = file => relative(file).split("/")[0];
function resolve(importer, specifier) {
  const base = path.resolve(path.dirname(importer), specifier);
  return [base, ...[".ts", ".tsx", ".astro", ".js", ".json"].map(ext => base + ext), path.join(base, "index.ts")]
    .find(candidate => known.has(candidate));
}
function dependency(file, specifier, client, typeOnly = false) {
  if (!specifier.startsWith(".")) {
    if (["lib", "browser", "services", "data"].includes(layer(file)) && /^react(?:-dom)?(?:\/|$)/.test(specifier)) {
      failures.push(`${relative(file)}: React belongs in components or hooks`);
    }
    return;
  }
  const target = resolve(file, specifier);
  if (!target) {
    // Astro components can also import assets from public/.
    if (path.resolve(path.dirname(file), specifier).startsWith(path.resolve(root, "../public") + path.sep)) return;
    failures.push(`${relative(file)}: unresolved ${specifier}`);
    return;
  }
  const owner = layer(file);
  if (allowed[owner] && !allowed[client && owner === "layouts" ? "browser" : owner].includes(layer(target))) {
    failures.push(`${relative(file)}: ${owner} cannot import ${relative(target)}`);
  }
  if (!client && file.endsWith(".astro") && layer(target) === "browser") {
    failures.push(`${relative(file)}: browser import in server frontmatter`);
  }
  if (relative(file).startsWith("components/shared/") && layer(target) === "components" && !relative(target).startsWith("components/shared/")) {
    failures.push(`${relative(file)}: shared UI cannot depend on ${relative(target)}`);
  }
  if (!typeOnly) {
    graph.get(file).add(target);
    if (client) clientRoots.add(target);
  }
}
function inspect(file, source, client) {
  const ast = ts.createSourceFile(file + ".tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const typeOnly = ts.isImportDeclaration(node)
        ? Boolean(node.importClause && ts.isTypeOnlyImportDeclaration(node.importClause))
        : ts.isTypeOnlyExportDeclaration(node);
      dependency(file, node.moduleSpecifier.text, client, typeOnly);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) {
      dependency(file, node.arguments[0].text, client);
    }
    if (layer(file) === "lib" && !relative(file).includes("/__tests__/") && ts.isIdentifier(node) && browserGlobals.has(node.text)) {
      failures.push(`${relative(file)}: browser global ${node.text} belongs outside lib`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

for (const file of files.filter(file => /\.(astro|tsx?)$/.test(file))) {
  const source = await readFile(file, "utf8");
  graph.set(file, new Set());
  if (file.endsWith(".astro")) {
    const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (frontmatter) inspect(file, frontmatter[1], false);
    const markup = frontmatter ? source.slice(frontmatter[0].length) : source;
    if (layer(file) === "pages" && /<(?:script|style)\b|\bstyle\s*=/.test(markup)) {
      failures.push(`${relative(file)}: pages compose components; move scripts and styles to their owner`);
    }
    for (const script of markup.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      const src = script[1].match(/\bsrc=["']([^"']+)["']/);
      if (src) dependency(file, src[1], true);
      else inspect(file, script[2], true);
    }
  } else {
    inspect(file, source, false);
    if (["browser", "hooks"].includes(layer(file)) || file.endsWith(".tsx")) clientRoots.add(file);
  }
}

const server = path.join(root, "services/github.ts");
for (const start of clientRoots) {
  const pending = [start];
  const visited = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    if (file === server) failures.push(`${relative(start)}: client dependency reaches services/github.ts`);
    pending.push(...graph.get(file) ?? []);
  }
}

if (failures.length) {
  console.error([...new Set(failures)].join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Architecture: ${graph.size} source files, resolved imports and layer boundaries checked.`);
}
