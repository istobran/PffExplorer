import type { ResourceEntry, SortKey } from "@/types";

export function basename(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

export function entryKey(entry: Pick<ResourceEntry, "archivePath" | "tableIndex">) {
  return `${entry.archivePath}::${entry.tableIndex}`;
}

export function hex32(value: number) {
  return `0x${(value >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

export function formatBytes(size: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return unit === 0
    ? `${size} ${units[unit]}`
    : `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

export function compareRows(a: ResourceEntry, b: ResourceEntry, key: SortKey, asc: boolean) {
  let left: string | number | null = a[key];
  let right: string | number | null = b[key];

  if (key === "checksum") {
    left = a.checksum ?? -1;
    right = b.checksum ?? -1;
  }

  if (typeof left === "string") left = left.toLowerCase();
  if (typeof right === "string") right = right.toLowerCase();

  let result = 0;
  if (left == null && right != null) result = -1;
  else if (left != null && right == null) result = 1;
  else if (left != null && right != null) result = left > right ? 1 : left < right ? -1 : 0;

  if (result === 0) {
    result = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  }

  return asc ? result : -result;
}
