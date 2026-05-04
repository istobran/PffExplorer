import { createContext, useContext, useMemo, type ReactNode } from "react";

export const DEFAULT_LOCALE = "zh-CN";
export const LOCALES = ["zh-CN", "en-US"] as const;

export type Locale = (typeof LOCALES)[number];

export type TranslationParams = Record<string, string | number>;

const translations = {
  "en-US": {
    "app.title": "PFF RESOURCE EXPLORER",
    "app.packageCount": "{count} PFF",
    "app.fileCount": "{count} FILES",
    "app.exportedCount": "{exported}/{total} EXPORTED",
    "app.progressCount": "{current}/{total}",

    "title.openProject": "OPEN PROJECT",
    "title.openProject.title": "Open game directory",
    "title.openFile": "OPEN FILE",
    "title.openFile.title": "Open single PFF file",
    "title.music.off": "Turn background music off",
    "title.music.on": "Turn background music on",
    "title.sound.mute": "Mute sounds",
    "title.sound.unmute": "Unmute sounds",
    "title.language.toEnglish": "Switch to English",
    "title.language.toChinese": "Switch to Chinese",
    "title.minimize": "Minimize",
    "title.close": "Close",

    "panel.packages": "PACKAGES",
    "panel.resources": "RESOURCE FILES",
    "panel.preview": "FILE PREVIEW",

    "package.all": "ALL PACKAGES",
    "package.close": "Close {name}",
    "package.empty": "OPEN A PFF OR PROJECT",
    "package.aria": "Packages",

    "resource.filter": "FILTER:",
    "resource.search": "SEARCH FILES...",
    "resource.export": "EXPORT",
    "resource.exporting": "EXPORTING",
    "resource.exportWithCount": "EXPORT ({count})",
    "resource.export.title": "Export exact bytes stored in the archive",
    "resource.empty": "NO MATCHING FILES",
    "resource.aria": "Resource files",
    "resource.header.filename": "FILENAME",
    "resource.header.package": "PACKAGE",
    "resource.header.type": "TYPE",
    "resource.header.size": "SIZE",
    "resource.header.offset": "OFFSET",
    "resource.header.checksum": "CHECKSUM",

    "format.type": "TYPE:",
    "format.all": "ALL",
    "format.count": "{count} TYPES",
    "format.allTypes": "ALL TYPES",

    "preview.select": "SELECT A RESOURCE TO PREVIEW",
    "preview.loading.text": "LOADING TEXT PREVIEW...",
    "preview.loading.remainingText": "LOADING REMAINING TEXT...",
    "preview.decoding": "DECODING PREVIEW",
    "preview.noData": "NO PREVIEW DATA",
    "preview.binary": "BINARY FILE",
    "preview.imageMode": "Image preview mode",
    "preview.nightVision": "Night vision preview",
    "preview.originalColor": "Original color preview",
    "preview.imageFailed": "IMAGE LOAD FAILED",
    "preview.audioPreparing": "PREPARING AUDIO",
    "preview.audioPlay": "Play audio",
    "preview.audioPause": "Pause audio",
    "preview.audioRestart": "Restart audio",
    "preview.audioVolume": "Audio preview volume",
    "preview.audioFailed": "AUDIO DECODE FAILED",

    "dialog.confirm": "CONFIRM",
    "dialog.cancel": "CANCEL",
    "dialog.ok": "OK",
    "dialog.batchExport.title": "BATCH EXPORT",
    "dialog.batchExport.message": "Selected resources will be exported into package folders under:",
    "dialog.batchExport.confirm": "EXPORT",

    "system.openProject.title": "Open game/resource directory",
    "system.openProject.empty": "No PFF files were found in this project directory.",
    "system.openProject.messageTitle": "Open project",
    "system.openProject.failed": "Project scan failed",
    "system.openFile.title": "Open PFF file",
    "system.openFile.filter": "PFF archives",
    "system.configRestoreFailed": "Config restore failed",
    "system.configSaveFailed": "Config save failed",
    "system.pffLoadFailed": "PFF load failed",
    "system.exportSingle.title": "Export RAW resource",
    "system.exportBatch.title": "Export {count} RAW resources",
    "system.exportFailed": "Export failed",
    "system.exportErrors.title": "Batch export completed with errors",
    "system.exportErrors.summary": "Exported {exported} of {total} resources.",
    "system.exportErrors.more": "...and {count} more failures.",

    "status.ver": "VER",
    "status.status": "STATUS",
    "status.pkg": "PKG",
    "status.total": "TOTAL",
    "status.data": "DATA",
    "status.warn": "WARN",
    "status.ready": "READY",
    "status.readyWarnings": "READY WITH WARNINGS",
    "status.readyErrors": "READY WITH ERRORS",
    "status.error": "ERROR",
    "status.scanning": "SCANNING",
    "status.loaded": "LOADED",
    "status.exporting": "EXPORTING",
    "status.idle": "IDLE",
    "status.pffLoad": "PFF LOAD",
    "status.export": "EXPORT",
    "status.savedPackages": "SAVED PACKAGES",
  },
  "zh-CN": {
    "app.title": "PFF 资源管理器",
    "app.packageCount": "{count} 个 PFF",
    "app.fileCount": "{count} 个文件",
    "app.exportedCount": "已导出 {exported}/{total}",
    "app.progressCount": "{current}/{total}",

    "title.openProject": "打开项目",
    "title.openProject.title": "打开游戏目录",
    "title.openFile": "打开文件",
    "title.openFile.title": "打开单个 PFF 文件",
    "title.music.off": "关闭背景音乐",
    "title.music.on": "开启背景音乐",
    "title.sound.mute": "静音",
    "title.sound.unmute": "取消静音",
    "title.language.toEnglish": "切换到英文",
    "title.language.toChinese": "切换到中文",
    "title.minimize": "最小化",
    "title.close": "关闭",

    "panel.packages": "资源包",
    "panel.resources": "资源文件",
    "panel.preview": "文件预览",

    "package.all": "全部资源包",
    "package.close": "关闭 {name}",
    "package.empty": "打开 PFF 或项目",
    "package.aria": "资源包",

    "resource.filter": "筛选:",
    "resource.search": "搜索文件...",
    "resource.export": "导出",
    "resource.exporting": "导出中",
    "resource.exportWithCount": "导出 ({count})",
    "resource.export.title": "导出资源包中的原始字节",
    "resource.empty": "没有匹配文件",
    "resource.aria": "资源文件",
    "resource.header.filename": "文件名",
    "resource.header.package": "资源包",
    "resource.header.type": "类型",
    "resource.header.size": "大小",
    "resource.header.offset": "偏移",
    "resource.header.checksum": "校验",

    "format.type": "类型:",
    "format.all": "全部",
    "format.count": "{count} 类型",
    "format.allTypes": "全部类型",

    "preview.select": "选择资源以预览",
    "preview.loading.text": "正在加载文本预览...",
    "preview.loading.remainingText": "正在加载剩余文本...",
    "preview.decoding": "正在解码预览",
    "preview.noData": "没有预览数据",
    "preview.binary": "二进制文件",
    "preview.imageMode": "图片预览模式",
    "preview.nightVision": "夜视预览",
    "preview.originalColor": "原始色彩预览",
    "preview.imageFailed": "图片加载失败",
    "preview.audioPreparing": "正在准备音频",
    "preview.audioPlay": "播放音频",
    "preview.audioPause": "暂停音频",
    "preview.audioRestart": "重新播放音频",
    "preview.audioVolume": "音频预览音量",
    "preview.audioFailed": "音频解码失败",

    "dialog.confirm": "确认",
    "dialog.cancel": "取消",
    "dialog.ok": "确定",
    "dialog.batchExport.title": "批量导出",
    "dialog.batchExport.message": "选中资源将按资源包目录导出到:",
    "dialog.batchExport.confirm": "导出",

    "system.openProject.title": "打开游戏/资源目录",
    "system.openProject.empty": "此项目目录中没有找到 PFF 文件。",
    "system.openProject.messageTitle": "打开项目",
    "system.openProject.failed": "项目扫描失败",
    "system.openFile.title": "打开 PFF 文件",
    "system.openFile.filter": "PFF 资源包",
    "system.configRestoreFailed": "配置恢复失败",
    "system.configSaveFailed": "配置保存失败",
    "system.pffLoadFailed": "PFF 加载失败",
    "system.exportSingle.title": "导出 RAW 资源",
    "system.exportBatch.title": "导出 {count} 个 RAW 资源",
    "system.exportFailed": "导出失败",
    "system.exportErrors.title": "批量导出完成但存在错误",
    "system.exportErrors.summary": "已导出 {exported}/{total} 个资源。",
    "system.exportErrors.more": "...还有 {count} 个失败项。",

    "status.ver": "版本",
    "status.status": "状态",
    "status.pkg": "资源包",
    "status.total": "总数",
    "status.data": "数据",
    "status.warn": "警告",
    "status.ready": "就绪",
    "status.readyWarnings": "就绪但有警告",
    "status.readyErrors": "就绪但有错误",
    "status.error": "错误",
    "status.scanning": "扫描中",
    "status.loaded": "已加载",
    "status.exporting": "导出中",
    "status.idle": "空闲",
    "status.pffLoad": "PFF 加载",
    "status.export": "导出",
    "status.savedPackages": "已保存资源包",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en-US"];

type I18nContextValue = {
  locale: Locale;
  t: (key: TranslationKey, params?: TranslationParams) => string;
};

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  t: (key, params) => translate(DEFAULT_LOCALE, key, params),
});

export function I18nProvider(props: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale: props.locale,
      t: (key, params) => translate(props.locale, key, params),
    }),
    [props.locale],
  );

  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function translate(
  locale: Locale,
  key: TranslationKey,
  params: TranslationParams = {},
) {
  const template = translations[locale][key] ?? translations["en-US"][key];
  return String(template).replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ""));
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.includes(value as Locale);
}
