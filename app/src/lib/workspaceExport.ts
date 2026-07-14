// 这个文件负责把导图和脑洞报告转换为可下载文本，并提供安全的浏览器下载入口。
import type {
  BrainstormMap,
  DimensionWord,
  IdeaCard,
  IdeaRefinement,
  RefinementDirection,
  RefinementMvpStep,
  RefinementRoleFeedback,
} from "../types/idea";

const MAX_FILE_NAME_LENGTH: number = 80;
const FALLBACK_FILE_NAME: string = "idea-lab";
const WINDOWS_RESERVED_FILE_NAME: RegExp = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

// 清理单个文件名片段中的 Windows 非法字符、冗余空格和末尾句点。
function sanitizeFileNamePart(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
}

// 在不留下半个代理字符的前提下按 JavaScript 字符长度截断文本。
function truncateText(value: string, maxLength: number): string {
  const truncated: string = value.slice(0, Math.max(0, maxLength));
  return /[\ud800-\udbff]$/.test(truncated) ? truncated.slice(0, -1) : truncated;
}

// 优先使用脑洞的来源路径，缺失时回退到参与碰撞的来源词。
function getIdeaSourcePath(idea: IdeaCard): string {
  const sourcePath: string[] = (idea.sourcePath ?? [])
    .map((segment: string): string => segment.trim())
    .filter((segment: string): boolean => segment.length > 0);
  if (sourcePath.length > 0) return sourcePath.join(" -> ");

  const sourceWords: string[] = idea.sourceWords
    .map((word: DimensionWord): string => word.text.trim())
    .filter((word: string): boolean => word.length > 0);
  return sourceWords.length > 0 ? sourceWords.join(" -> ") : "未记录";
}

// 把炼化结果追加为生命力、方向、时间线和编辑部批注四个 Markdown 区块。
function appendRefinementSections(sections: string[], refinement: IdeaRefinement): void {
  sections.push(
    "## 生命力",
    "",
    `- **目标用户：** ${refinement.vitality.targetUser}`,
    `- **触发场景：** ${refinement.vitality.triggerScene}`,
    `- **核心情绪：** ${refinement.vitality.coreEmotion}`,
    `- **已有替代：** ${refinement.vitality.existingAlternative}`,
    `- **最小可玩：** ${refinement.vitality.smallestPlayableVersion}`,
    "",
    "## 三种方向",
    "",
  );

  refinement.directions.forEach((direction: RefinementDirection): void => {
    sections.push(
      `### ${direction.type}：${direction.title}`,
      "",
      direction.description,
      "",
      `**第一步：** ${direction.firstStep}`,
      "",
    );
  });

  sections.push("## 1小时 / 1天 / 一周", "");
  refinement.mvpLadder.forEach((step: RefinementMvpStep): void => {
    sections.push(
      `### ${step.horizon}`,
      "",
      `- **目标：** ${step.goal}`,
      `- **实现：** ${step.build}`,
      `- **验证：** ${step.proof}`,
      "",
    );
  });

  sections.push("## 编辑部批注", "");
  refinement.roundtable.forEach((item: RefinementRoleFeedback): void => {
    sections.push(`> **${item.role}：** ${item.feedback}`, "");
  });
}

// 将完整思维导图导出为两个空格缩进的可读 JSON。
export function exportMindMapJson(map: BrainstormMap): string {
  const serializedMap: string | undefined = JSON.stringify(map, null, 2);
  if (serializedMap === undefined) throw new Error("无法导出导图：数据不可序列化。");
  return serializedMap;
}

// 将脑洞和可选炼化结果导出为结构清晰的 Markdown 报告。
export function exportIdeaReportMarkdown(idea: IdeaCard, refinement?: IdeaRefinement): string {
  const sections: string[] = [
    `# ${idea.title}`,
    "",
    "## 一句话",
    "",
    idea.summary,
    "",
    "## 来源路径",
    "",
    getIdeaSourcePath(idea),
    "",
    "## 为什么值得做",
    "",
    idea.whyInteresting,
    "",
    "## 第一版",
    "",
    idea.firstVersion,
    "",
  ];

  if (refinement) appendRefinementSections(sections, refinement);
  return `${sections.join("\n").trimEnd()}\n`;
}

// 根据主题、标题和扩展名生成不超过八十个字符的安全下载文件名。
export function buildDownloadFileName(topic: string, title: string, extension: string): string {
  const topicPart: string = sanitizeFileNamePart(topic);
  const titlePart: string = sanitizeFileNamePart(title);
  const rawBaseName: string = [topicPart, titlePart].filter((part: string): boolean => part.length > 0).join("-");
  let baseName: string = rawBaseName || FALLBACK_FILE_NAME;
  if (WINDOWS_RESERVED_FILE_NAME.test(baseName)) baseName = `${FALLBACK_FILE_NAME}-${baseName}`;

  const rawExtension: string = sanitizeFileNamePart(extension).replace(/^\.+/, "").replace(/\s+/g, "");
  const extensionPart: string = truncateText(rawExtension, MAX_FILE_NAME_LENGTH - 2);
  const suffix: string = extensionPart.length > 0 ? `.${extensionPart}` : "";
  const availableBaseLength: number = MAX_FILE_NAME_LENGTH - suffix.length;
  const truncatedBaseName: string = truncateText(baseName, availableBaseLength).replace(/[. ]+$/g, "");
  const fallbackBaseName: string = truncatedBaseName || truncateText(FALLBACK_FILE_NAME, availableBaseLength);
  const prefixedBaseName: string = WINDOWS_RESERVED_FILE_NAME.test(fallbackBaseName)
    ? `${FALLBACK_FILE_NAME}-${fallbackBaseName}`
    : fallbackBaseName;
  const finalBaseName: string = truncateText(prefixedBaseName, MAX_FILE_NAME_LENGTH);
  const finalExtensionLength: number = Math.max(0, MAX_FILE_NAME_LENGTH - finalBaseName.length - 1);
  const finalExtensionPart: string = truncateText(extensionPart, finalExtensionLength);
  const finalSuffix: string = finalExtensionPart.length > 0 ? `.${finalExtensionPart}` : "";

  return `${finalBaseName}${finalSuffix}`;
}

// 使用临时对象地址触发浏览器文本下载，并在点击后立即释放地址。
export function createTextDownload(text: string, fileName: string, mimeType: string): void {
  const blob: Blob = new Blob([text], { type: mimeType });
  const objectUrl: string = URL.createObjectURL(blob);
  const anchor: HTMLAnchorElement = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.hidden = true;
  document.body.append(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }
}
