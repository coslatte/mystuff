import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "@astrojs/compiler";
import { en as englishSchema } from "../src/lib/i18n/en.ts";
import { catalogs, sourceMessages as en } from "../src/lib/i18n/catalog.ts";

const owners = new Map();
for (const [section, fields] of Object.entries(englishSchema)) {
  for (const field of Object.keys(fields)) {
    const key = `${section}.${field}`;
    if (owners.has(key)) throw new Error(`${key} belongs to both ${owners.get(key)} and ${section}`);
    owners.set(key, section);
  }
}
for (const [locale, catalog] of Object.entries(catalogs)) {
  for (const [key, source] of Object.entries(en)) {
    const translated = catalog[key];
    if (typeof translated !== "string") throw new Error(`${locale}: missing ${key}`);
    if (placeholders(source) !== placeholders(translated)) {
      throw new Error(`${locale}: interpolation parameters differ for ${key}`);
    }
  }
  for (const key of Object.keys(catalog)) {
    if (!Object.hasOwn(en, key)) throw new Error(`${locale}: unknown ${key}`);
  }
}

function placeholders(text) {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]))].sort().join(",");
}

const root = process.cwd();
const files = await sourceFiles(path.join(root, "src"));
const bySource = new Map(Object.entries(en).map(([key, value]) => [normalize(value), key]));
const ignoredTags = new Set(["script", "style", "pre", "code", "textarea", "title", "option"]);
const ignoredFiles = new Set(["components/LocalizedText.astro"]);
const remaining = [];

for (const file of files) {
  if (ignoredFiles.has(path.relative(path.join(root, "src"), file).replaceAll("\\", "/"))) continue;
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/(["'`])([a-zA-Z]\w*\.\w+)\1/g)) {
    if (Object.hasOwn(en, match[2])) remaining.push({ file, key: match[2], reason: "use the generated messages reference" });
  }
  if (!file.endsWith(".astro")) continue;
  const { ast, diagnostics } = await parse(source, { position: true });
  if (diagnostics.some(({ severity }) => severity === 1)) {
    throw new Error(`Could not parse ${path.relative(root, file)}`);
  }

  const visit = (node, ignored = false) => {
    const skip = ignored || ignoredTags.has(node.name) || node.attributes?.some(attribute =>
      attribute.name === "translate" && attribute.value === "no",
    );
    if (node.type === "text" && !skip && node.parent?.type === "element" && !hasI18nTextAncestor(node.parent)) {
      const key = bySource.get(normalize(node.value));
      if (key) remaining.push({ file, key, reason: "duplicated catalog copy" });
    }
    for (const child of node.children ?? []) {
      child.parent = node;
      visit(child, skip);
    }
  };
  visit(ast);

}

if (remaining.length) {
  for (const { file, key, reason } of remaining) console.error(`${path.relative(root, file)}: ${key}: ${reason}`);
  process.exitCode = 1;
} else {
  console.log(`${Object.keys(en).length} messages across ${Object.keys(catalogs).length} locales: matching fields and parameters; no handwritten IDs or duplicated Astro text.`);
}

function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}

function hasI18nTextAncestor(node) {
  for (let current = node; current; current = current.parent) {
    if (current.attributes?.some(attribute => attribute.name === "data-i18n-text")) return true;
  }
  return false;
}

async function sourceFiles(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await sourceFiles(fullPath));
    else if (entry.isFile() && /\.(astro|tsx?)$/.test(fullPath)) found.push(fullPath);
  }
  return found;
}
