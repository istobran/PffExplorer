import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourceDir = path.join(rootDir, "src");
const sourceFontPath = path.join(sourceDir, "assets/fonts/guangliang-ganbei.ttf");
const generatedFontDir = path.join(sourceDir, "assets/fonts/generated");
const generatedFontPath = path.join(generatedFontDir, "guangliang-ganbei-subset.woff2");

const textFileExtensions = new Set([
  ".css",
  ".html",
  ".json",
  ".md",
  ".ts",
  ".tsx",
]);
const skippedDirectoryNames = new Set([
  ".git",
  "dist",
  "node_modules",
  "target",
]);
const cjkOrPunctuationPattern =
  /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/gu;

async function main() {
  const sourceFont = await fs.readFile(sourceFontPath);
  const characters = await collectUsedChineseCharacters(sourceDir);

  if (characters.length === 0) {
    throw new Error("No Chinese glyphs were found while generating the Chinese font subset.");
  }

  const subset = await subsetFont(sourceFont, characters.join(""), {
    targetFormat: "woff2",
  });

  await fs.mkdir(generatedFontDir, { recursive: true });
  await writeIfChanged(generatedFontPath, subset);

  const originalSize = formatBytes(sourceFont.byteLength);
  const subsetSize = formatBytes(subset.byteLength);
  console.log(
    `[fonts] GuangLiang GanBei subset: ${characters.length} glyphs, ${originalSize} -> ${subsetSize}`,
  );
}

async function collectUsedChineseCharacters(directory) {
  const characters = new Set();
  const files = await collectTextFiles(directory);

  for (const file of files) {
    const content = await fs.readFile(file, "utf8");

    for (const match of content.matchAll(cjkOrPunctuationPattern)) {
      characters.add(match[0]);
    }
  }

  return Array.from(characters).sort((left, right) => left.localeCompare(right, "zh-CN"));
}

async function collectTextFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (skippedDirectoryNames.has(entry.name)) continue;
      files.push(...await collectTextFiles(entryPath));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!textFileExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    files.push(entryPath);
  }

  return files;
}

async function writeIfChanged(filePath, content) {
  try {
    const existing = await fs.readFile(filePath);
    if (existing.equals(content)) return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  await fs.writeFile(filePath, content);
}

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
