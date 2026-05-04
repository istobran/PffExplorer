import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFont, woff2 } from "fonteditor-core";
import subsetFont from "subset-font";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourceDir = path.join(rootDir, "src");
const sourceFontPath = path.join(sourceDir, "assets/fonts/guangliang-ganbei.ttf");
const generatedFontDir = path.join(sourceDir, "assets/fonts/generated");
const generatedFontPath = path.join(generatedFontDir, "guangliang-ganbei-subset.woff2");
const i18nSourcePath = path.join(sourceDir, "lib/i18n.tsx");
const cjkOrPunctuationPattern =
  /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/gu;
const glyphShiftEm = Number(process.env.PFF_EXPLORER_CHINESE_FONT_SHIFT_EM ?? "0.05");

async function main() {
  const sourceFont = await fs.readFile(sourceFontPath);
  const characters = await collectUsedChineseCharacters();

  if (characters.length === 0) {
    throw new Error("No Chinese glyphs were found while generating the Chinese font subset.");
  }

  const subsetSfnt = await subsetFont(sourceFont, characters.join(""), {
    targetFormat: "sfnt",
  });
  const subset = await shiftGlyphsUp(subsetSfnt, glyphShiftEm);

  await fs.mkdir(generatedFontDir, { recursive: true });
  await writeIfChanged(generatedFontPath, subset);

  const originalSize = formatBytes(sourceFont.byteLength);
  const subsetSize = formatBytes(subset.byteLength);
  console.log(
    `[fonts] GuangLiang GanBei subset: ${characters.length} glyphs, ${originalSize} -> ${subsetSize}`,
  );
}

async function shiftGlyphsUp(fontBuffer, shiftEm) {
  await woff2.init();

  const font = createFont(fontBuffer, {
    type: "ttf",
    compound2simple: true,
  });
  const ttf = font.get();
  const unitsPerEm = ttf.head?.unitsPerEm ?? 1000;
  const yOffset = Math.round(unitsPerEm * shiftEm);

  if (yOffset !== 0) {
    for (const glyph of ttf.glyf ?? []) {
      translateGlyph(glyph, yOffset);
    }
  }

  font.set(ttf);
  return font.write({
    type: "woff2",
    toBuffer: true,
  });
}

function translateGlyph(glyph, yOffset) {
  if (!glyph?.contours?.length) return;

  for (const contour of glyph.contours) {
    for (const point of contour) {
      point.y += yOffset;
    }
  }

  if (typeof glyph.yMin === "number") {
    glyph.yMin += yOffset;
  }
  if (typeof glyph.yMax === "number") {
    glyph.yMax += yOffset;
  }
}

async function collectUsedChineseCharacters() {
  const characters = new Set();
  const content = await fs.readFile(i18nSourcePath, "utf8");

  for (const match of content.matchAll(cjkOrPunctuationPattern)) {
    characters.add(match[0]);
  }

  return Array.from(characters).sort((left, right) => left.localeCompare(right, "zh-CN"));
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
