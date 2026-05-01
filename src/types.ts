export type ResourceKind = "TEX" | "SND" | "MDL" | "SHD" | "CFG" | "DAT";

export type SortKey = "name" | "kind" | "size" | "offset" | "checksum" | "archiveName";

export type ExportMode = "raw" | "decoded";

export type ArchiveSummary = {
  path: string;
  name: string;
  version: string;
  fileCount: number;
  deletedCount: number;
  totalSize: number;
  archiveSize: number;
};

export type ResourceEntry = {
  archivePath: string;
  archiveName: string;
  tableIndex: number;
  name: string;
  kind: ResourceKind;
  size: number;
  offset: number;
  timestamp: number;
  checksum: number | null;
  flags: number;
};

export type ResourceTableRow = ResourceEntry & { rowNumber: number };

export type WorkspaceSnapshot = {
  archives: ArchiveSummary[];
  entries: ResourceEntry[];
  stats: {
    archiveCount: number;
    entryCount: number;
    totalSize: number;
    deletedCount: number;
  };
  warnings: string[];
};

export type PreviewResponse = {
  status: "text" | "binary" | "tooLarge";
  text: string | null;
  hexHead: string;
  byteLen: number;
  transforms: string[];
  message: string | null;
};

export type ExportResult = {
  outputPath: string;
  byteLen: number;
  transforms: string[];
};

export type StatusState = {
  label: string;
  target: string;
  progressLabel: string;
  progress: number | null;
};
