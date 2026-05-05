#!/usr/bin/env node

import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const args = process.argv.slice(2);

const tag = option("--tag") ?? `v${packageJson.version}`;
const title = option("--title") ?? `PFF 资源查看器 ${tag}`;
const repo = option("--repo") ?? githubRepoFromRemote("github") ?? githubRepoFromRemote("origin");
const dryRun = flag("--dry-run");
const skipBuild = flag("--skip-build");
const allowDirty = flag("--allow-dirty");
const draft = flag("--draft");
const prerelease = flag("--prerelease");

if (!repo) {
  fail("Cannot determine GitHub repository. Pass --repo owner/name or add a GitHub remote.");
}

if (!allowDirty) {
  const status = capture("git", ["status", "--porcelain"]);
  if (status.trim()) {
    fail("Working tree is dirty. Commit changes first or pass --allow-dirty.");
  }
}

if (!skipBuild) {
  run("pnpm", ["tauri:build:windows-msvc"]);
}

const sourceExe = join(
  repoRoot,
  "src-tauri",
  "target",
  "x86_64-pc-windows-msvc",
  "release",
  "pff-explorer.exe",
);
const releaseDir = join(repoRoot, "dist", "release");
const assetName = `${packageJson.name}-${tag}-windows-x64.exe`;
const releaseExe = join(releaseDir, assetName);

mkdirSync(releaseDir, { recursive: true });
copyFileSync(sourceExe, releaseExe);

const branch = capture("git", ["branch", "--show-current"]).trim() || "master";
const releaseNotes = [
  `PFF 资源查看器 ${tag}`,
  "",
  "- Windows x64 MSVC 单文件版本",
  "- 下载 exe 后可直接运行，无需安装包",
].join("\n");

const ghArgs = [
  "release",
  "create",
  tag,
  releaseExe,
  "--repo",
  repo,
  "--title",
  title,
  "--notes",
  releaseNotes,
  "--target",
  branch,
];

if (draft) ghArgs.push("--draft");
if (prerelease) ghArgs.push("--prerelease");

if (dryRun) {
  console.log("[dry-run] release asset:", releaseExe);
  console.log("[dry-run] gh", ghArgs.map(shellQuote).join(" "));
} else {
  run("gh", ghArgs);
}

function option(name) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = args.indexOf(name);
  if (index === -1) return null;

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    fail(`Missing value for ${name}.`);
  }
  return value;
}

function flag(name) {
  return args.includes(name);
}

function githubRepoFromRemote(remoteName) {
  const result = spawnSync("git", ["remote", "get-url", remoteName], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) return null;

  const url = result.stdout.trim();
  const match =
    url.match(/github\.com[:/](?<owner>[^/]+)\/(?<name>[^/.]+)(?:\.git)?$/) ??
    url.match(/^git@github\.com:(?<owner>[^/]+)\/(?<name>[^/.]+)(?:\.git)?$/);

  if (!match?.groups) return null;
  return `${match.groups.owner}/${match.groups.name}`;
}

function capture(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.error) fail(result.error.message);
  if (result.status !== 0) {
    fail((result.stderr || result.stdout || `${command} failed`).trim());
  }

  return result.stdout;
}

function run(command, commandArgs) {
  console.log(">", [command, ...commandArgs].map(shellQuote).join(" "));
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: "inherit",
  });

  if (result.error) fail(result.error.message);
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function shellQuote(value) {
  if (/^[\w./:=@-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function fail(message) {
  console.error(`[release:github] ${message}`);
  process.exit(1);
}
