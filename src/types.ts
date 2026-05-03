export type SortKey = "name" | "kind" | "size" | "offset" | "checksum" | "archiveName";

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
  kind: string;
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

export type AppConfig = {
  openedPffPaths: string[];
};

export type PreviewResponse = {
  status: "text" | "image" | "audio" | "binary" | "tooLarge";
  text: string | null;
  image: ImagePreview | null;
  audio: AudioPreview | null;
  hexHead: string;
  byteLen: number;
  transforms: string[];
  message: string | null;
};

export type ImagePreview = {
  dataUrl: string | null;
  filePath: string | null;
  width: number;
  height: number;
  format: string;
};

export type AudioPreview = {
  dataUrl: string | null;
  filePath: string | null;
  format: string;
  mimeType: string;
  codec: string;
  sampleRate: number | null;
  channels: number | null;
  bitsPerSample: number | null;
  durationSeconds: number | null;
  waveform: number[];
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
