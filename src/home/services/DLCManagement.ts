import { getFilteredEntries, getWorldBookName, updateWorldBook } from './worldbookload&update';

// ========================
// 排序相关函数
// ========================

/**
 * 按拼音首字母排序比较函数
 * 中文按照拼音首字母排序，英文按照 a-z 排序
 * @param a 第一个字符串
 * @param b 第二个字符串
 * @returns 比较结果
 */
function pinyinCompare(a: string, b: string): number {
  return a.localeCompare(b, 'zh-CN', { sensitivity: 'base' });
}

/**
 * 对角色选项进行排序（按 label 的拼音首字母排序）
 * @param options 角色选项数组
 * @returns 排序后的角色选项数组
 */
export function sortCharacterOptions(options: CharacterOption[]): CharacterOption[] {
  return [...options].sort((a, b) => pinyinCompare(a.label, b.label));
}

/**
 * 对事件选项进行排序（按 label 的拼音首字母排序）
 * @param options 事件选项数组
 * @returns 排序后的事件选项数组
 */
export function sortEventOptions(options: EventOption[]): EventOption[] {
  return [...options].sort((a, b) => pinyinCompare(a.label, b.label));
}

/**
 * 对扩展选项进行排序（按 label 的拼音首字母排序）
 * @param options 扩展选项数组
 * @returns 排序后的扩展选项数组
 */
export function sortExtensionOptions(options: ExtensionOption[]): ExtensionOption[] {
  return [...options].sort((a, b) => pinyinCompare(a.label, b.label));
}

// ========================
// 角色相关类型和常量
// ========================

// 角色选项类型
export interface CharacterOption {
  value: string; // 完整条目名称，如 "[角色]name(A-原创角色)"
  label: string; // 显示名称，如 "name"
  author: string; // 作者，如 "A"
  info: string; // 其他信息，如 "原创角色"
  enabled: boolean;
}

// 角色条目匹配模式 - 匹配以"[角色]"开头的条目
const CHARACTER_PATTERN = /^\[角色\]/;

// 解析角色名和作者的正则 - 匹配 "角色名(作者)" 格式
const CHARACTER_NAME_PATTERN = /^(.+?)(?:\(([^)]+)\))?$/;

/**
 * 角色状态初始值
 */
export const initialCharacterState = {
  characterOptions: [] as CharacterOption[],
  localCharacterSelections: new Map<string, boolean>(),
};

// ========================
// 事件相关类型和常量
// ========================

// 事件条目类型（单个世界书条目）
export interface EventEntry {
  name: string; // 完整条目名称，如 "[事件][双子]双子星的咏叹调-本体"
  enabled: boolean;
}

// 事件选项类型（分组后的事件）
export interface EventOption {
  eventKey: string; // 事件唯一标识，如 "[事件][双子]"
  label: string; // 显示名称，如 "双子"
  author: string; // 作者（从条目中提取）
  info: string; // 其他信息（从条目中提取）
  entries: EventEntry[]; // 该事件下的所有条目
  enabled: boolean; // 事件是否启用（所有条目启用时为true）
}

// 事件条目匹配模式 - 匹配以"[事件]"开头的条目
const EVENT_PATTERN = /^\[事件\]/;

// 提取事件名的正则 - 匹配 "[事件][事件名]" 格式
const EVENT_KEY_PATTERN = /^(\[事件\]\[[^\]]+\])/;

// 提取事件显示名称的正则 - 匹配 "[事件名]" 中的事件名
const EVENT_LABEL_PATTERN = /^\[事件\]\[([^\]]+)\]/;

// 提取作者的正则 - 匹配最后一个 "(作者)" 格式（事件和扩展通用）
const AUTHOR_PATTERN = /\(([^)]+)\)(?=[^()]*$)/;

/**
 * 事件状态初始值
 */
export const initialEventState = {
  eventOptions: [] as EventOption[],
  localEventSelections: new Map<string, boolean>(),
};

// ========================
// 扩展相关类型和常量
// ========================

// 扩展条目类型（单个世界书条目）
export interface ExtensionEntry {
  name: string; // 完整条目名称，如 "[扩展][无尽深渊地城扩展][!原版无尽深渊地城]无尽深渊地城-控制(Hilo)"
  enabled: boolean;
}

// 扩展选项类型（分组后的扩展）
export interface ExtensionOption {
  extensionKey: string; // 扩展唯一标识，如 "[扩展][无尽深渊地城扩展]"
  label: string; // 显示名称，如 "无尽深渊地城扩展"
  author: string; // 作者，如 "Hilo"
  info: string; // 其他信息
  // 互斥目标数组 - [!xxx] 格式，开启时关闭包含 [xxx] 的扩展
  exclusionTargets: string[];
  // 替换目标数组 - [>xxx] 格式，开启时关闭包含 [xxx] 的条目，关闭时恢复
  replacementTargets: string[];
  // 前置需求数组 - [<xxx] 格式，需要 [xxx] 扩展处于开启状态
  prerequisiteTargets: string[];
  entries: ExtensionEntry[]; // 该扩展下的所有条目
  enabled: boolean; // 扩展是否启用（所有条目启用时为true）
}

// 扩展条目匹配模式 - 匹配以"[扩展]"开头的条目
const EXTENSION_PATTERN = /^\[扩展\]/;

// 提取扩展Key的正则 - 只匹配 "[扩展][扩展名]" 格式（不包含关系标记，以便同一扩展只需标记一次）
const EXTENSION_KEY_PATTERN = /^(\[扩展\]\[[^\]]+\])/;

// 提取扩展显示名称的正则 - 匹配 "[扩展][扩展名]" 中的扩展名
const EXTENSION_LABEL_PATTERN = /^\[扩展\]\[([^\]]+)\]/;

// 提取互斥目标的正则 - 匹配所有 "[!互斥条目]" 中的互斥条目名（全局匹配）
const EXTENSION_EXCLUSION_PATTERN = /\[!([^\]]+)\]/g;

// 提取替换目标的正则 - 匹配所有 "[>替换条目]" 中的替换条目名（全局匹配）
const EXTENSION_REPLACEMENT_PATTERN = /\[>([^\]]+)\]/g;

// 提取前置需求的正则 - 匹配所有 "[<前置扩展]" 中的前置扩展名（全局匹配）
const EXTENSION_PREREQUISITE_PATTERN = /\[<([^\]]+)\]/g;

/**
 * 扩展状态初始值
 */
export const initialExtensionState = {
  extensionOptions: [] as ExtensionOption[],
  localExtensionSelections: new Map<string, boolean>(),
};

/**
 * 解析角色条目名称，提取角色名、作者和其他信息
 * @param entryName 完整条目名称，如 "[角色]薇薇拉(K1nn-原创角色)"
 * @returns { label: string, author: string, info: string }
 */
function parseCharacterName(entryName: string): { label: string; author: string; info: string } {
  // 去掉"[角色]"前缀
  const nameWithAuthor = entryName.replace(CHARACTER_PATTERN, '');

  // 解析角色名和作者-信息
  const match = nameWithAuthor.match(CHARACTER_NAME_PATTERN);
  if (match) {
    const authorInfo = match[2]?.trim() || '';
    // 检查是否包含 "-" 分隔符
    const dashIndex = authorInfo.indexOf('-');
    if (dashIndex > 0) {
      return {
        label: match[1].trim(),
        author: authorInfo.substring(0, dashIndex).trim(),
        info: authorInfo.substring(dashIndex + 1).trim(),
      };
    }
    return {
      label: match[1].trim(),
      author: authorInfo,
      info: '',
    };
  }

  return { label: nameWithAuthor, author: '', info: '' };
}

/**
 * 加载角色列表
 */
export async function loadCharacterOptions(): Promise<{
  characterOptions: CharacterOption[];
  localCharacterSelections: Map<string, boolean>;
  bookName: string | null;
}> {
  const bookName = getWorldBookName();
  const entries = await getFilteredEntries(CHARACTER_PATTERN, bookName);

  const characterOptions = entries.map((entry: { name: string; enabled: boolean }) => {
    const { label, author, info } = parseCharacterName(entry.name);
    return {
      value: entry.name,
      label,
      author,
      info,
      enabled: entry.enabled,
    };
  });

  // 对角色选项进行排序（按拼音首字母）
  const sortedCharacterOptions = sortCharacterOptions(characterOptions);

  // 初始化本地选择列表（从世界书的原始状态复制）
  const localCharacterSelections = new Map(
    sortedCharacterOptions.map(char => [char.value, char.enabled]),
  );

  return { characterOptions: sortedCharacterOptions, localCharacterSelections, bookName };
}

/**
 * 切换角色启用状态（更新本地状态，返回新的选择Map）
 */
export function toggleCharacter(
  localCharacterSelections: Map<string, boolean>,
  characterValue: string,
): Map<string, boolean> {
  const newSelections = new Map(localCharacterSelections);
  const currentEnabled = newSelections.get(characterValue) ?? false;
  newSelections.set(characterValue, !currentEnabled);
  return newSelections;
}

/**
 * 检查本地选择是否与原始状态有变化
 */
export function hasCharacterChanges(
  characterOptions: CharacterOption[],
  localCharacterSelections: Map<string, boolean>,
): boolean {
  for (const char of characterOptions) {
    const localEnabled = localCharacterSelections.get(char.value) ?? false;
    if (localEnabled !== char.enabled) {
      return true;
    }
  }
  return false;
}

/**
 * 保存角色选择到世界书
 * @param characterOptions 角色选项列表
 * @param localCharacterSelections 本地选择状态
 * @param bookName 世界书名称
 * @returns 更新后的角色选项列表
 */
export async function saveCharacterChanges(
  characterOptions: CharacterOption[],
  localCharacterSelections: Map<string, boolean>,
  bookName: string,
): Promise<CharacterOption[]> {
  if (!hasCharacterChanges(characterOptions, localCharacterSelections)) {
    return characterOptions;
  }

  // 构建更新列表
  const updatedEntries = Array.from(localCharacterSelections).map(([name, enabled]) => ({
    name,
    enabled,
  }));

  await updateWorldBook(updatedEntries, bookName);

  // 返回更新后的角色选项列表
  return characterOptions.map(char => ({
    ...char,
    enabled: localCharacterSelections.get(char.value) ?? false,
  }));
}

// ========================
// 事件相关函数
// ========================

/**
 * 从条目名称中提取事件Key
 * @param entryName 完整条目名称，如 "[事件][双子]双子星的咏叹调-本体"
 * @returns 事件Key，如 "[事件][双子]"，如果不匹配则返回null
 */
function extractEventKey(entryName: string): string | null {
  const match = entryName.match(EVENT_KEY_PATTERN);
  return match ? match[1] : null;
}

/**
 * 从事件Key中提取显示名称
 * @param eventKey 事件Key，如 "[事件][双子]"
 * @returns 显示名称，如 "双子"
 */
function extractEventLabel(eventKey: string): string {
  const match = eventKey.match(EVENT_LABEL_PATTERN);
  return match ? match[1] : eventKey;
}

/**
 * 从事件条目中提取作者和信息
 * @param entries 事件下的所有条目
 * @returns { author: string, info: string }
 */
function extractEventAuthorInfo(entries: EventEntry[]): { author: string; info: string } {
  for (const entry of entries) {
    const match = entry.name.match(AUTHOR_PATTERN);
    if (match) {
      const authorInfo = match[1].trim();
      const dashIndex = authorInfo.indexOf('-');
      if (dashIndex > 0) {
        return {
          author: authorInfo.substring(0, dashIndex).trim(),
          info: authorInfo.substring(dashIndex + 1).trim(),
        };
      }
      return { author: authorInfo, info: '' };
    }
  }
  return { author: '', info: '' };
}

/**
 * 加载事件列表
 */
export async function loadEventOptions(): Promise<{
  eventOptions: EventOption[];
  localEventSelections: Map<string, boolean>;
  bookName: string | null;
}> {
  const bookName = getWorldBookName();
  const entries = await getFilteredEntries(EVENT_PATTERN, bookName);

  // 按事件Key分组条目
  const eventGroups = new Map<string, EventEntry[]>();

  for (const entry of entries as { name: string; enabled: boolean }[]) {
    const eventKey = extractEventKey(entry.name);
    if (!eventKey) continue;

    if (!eventGroups.has(eventKey)) {
      eventGroups.set(eventKey, []);
    }
    eventGroups.get(eventKey)!.push({
      name: entry.name,
      enabled: entry.enabled,
    });
  }

  // 构建事件选项列表
  const eventOptions: EventOption[] = [];
  for (const [eventKey, groupEntries] of eventGroups) {
    // 事件启用状态：所有条目都启用时为true
    const allEnabled = groupEntries.every(e => e.enabled);
    const { author, info } = extractEventAuthorInfo(groupEntries);
    eventOptions.push({
      eventKey,
      label: extractEventLabel(eventKey),
      author,
      info,
      entries: groupEntries,
      enabled: allEnabled,
    });
  }

  // 对事件选项进行排序（按拼音首字母）
  const sortedEventOptions = sortEventOptions(eventOptions);

  // 初始化本地选择列表（从分组状态复制）
  const localEventSelections = new Map(
    sortedEventOptions.map(event => [event.eventKey, event.enabled]),
  );

  return { eventOptions: sortedEventOptions, localEventSelections, bookName };
}

/**
 * 切换事件启用状态（更新本地状态，返回新的选择Map）
 */
export function toggleEvent(
  localEventSelections: Map<string, boolean>,
  eventKey: string,
): Map<string, boolean> {
  const newSelections = new Map(localEventSelections);
  const currentEnabled = newSelections.get(eventKey) ?? false;
  newSelections.set(eventKey, !currentEnabled);
  return newSelections;
}

/**
 * 检查本地事件选择是否与原始状态有变化
 */
export function hasEventChanges(
  eventOptions: EventOption[],
  localEventSelections: Map<string, boolean>,
): boolean {
  for (const event of eventOptions) {
    const localEnabled = localEventSelections.get(event.eventKey) ?? false;
    if (localEnabled !== event.enabled) {
      return true;
    }
  }
  return false;
}

/**
 * 保存事件选择到世界书
 * @param eventOptions 事件选项列表
 * @param localEventSelections 本地选择状态
 * @param bookName 世界书名称
 * @returns 更新后的事件选项列表
 */
export async function saveEventChanges(
  eventOptions: EventOption[],
  localEventSelections: Map<string, boolean>,
  bookName: string,
): Promise<EventOption[]> {
  if (!hasEventChanges(eventOptions, localEventSelections)) {
    return eventOptions;
  }

  // 构建更新列表：将每个事件的所有条目设置为相同的启用状态
  const updatedEntries: Array<{ name: string; enabled: boolean }> = [];

  for (const event of eventOptions) {
    const newEnabled = localEventSelections.get(event.eventKey) ?? false;
    for (const entry of event.entries) {
      updatedEntries.push({
        name: entry.name,
        enabled: newEnabled,
      });
    }
  }

  await updateWorldBook(updatedEntries, bookName);

  // 返回更新后的事件选项列表
  return eventOptions.map(event => {
    const newEnabled = localEventSelections.get(event.eventKey) ?? false;
    return {
      ...event,
      enabled: newEnabled,
      entries: event.entries.map(entry => ({
        ...entry,
        enabled: newEnabled,
      })),
    };
  });
}

// ========================
// 扩展相关函数
// ========================

/**
 * 从条目名称中提取扩展Key
 * @param entryName 完整条目名称，如 "[扩展][无尽深渊地城扩展][!原版无尽深渊地城]无尽深渊地城-控制(Hilo)"
 * @returns 扩展Key，如 "[扩展][无尽深渊地城扩展][!原版无尽深渊地城]"，如果不匹配则返回null
 */
function extractExtensionKey(entryName: string): string | null {
  const match = entryName.match(EXTENSION_KEY_PATTERN);
  return match ? match[1] : null;
}

/**
 * 从扩展Key中提取显示名称
 * @param extensionKey 扩展Key，如 "[扩展][无尽深渊地城扩展][!原版无尽深渊地城]"
 * @returns 显示名称，如 "无尽深渊地城扩展"
 */
function extractExtensionLabel(extensionKey: string): string {
  const match = extensionKey.match(EXTENSION_LABEL_PATTERN);
  return match ? match[1] : extensionKey;
}

/**
 * 从条目名称中提取所有互斥目标
 * @param entryName 条目名称，如 "[扩展][无尽深渊地城扩展][!原版无尽深渊地城][!另一个目标]..."
 * @returns 互斥目标数组
 */
function extractExclusionTargetsFromEntry(entryName: string): string[] {
  const targets: string[] = [];
  const regex = new RegExp(EXTENSION_EXCLUSION_PATTERN.source, 'g');
  let match;
  while ((match = regex.exec(entryName)) !== null) {
    targets.push(match[1]);
  }
  return targets;
}

/**
 * 从条目名称中提取所有替换目标
 * @param entryName 条目名称，如 "[扩展][xxx][>被替换条目]..."
 * @returns 替换目标数组
 */
function extractReplacementTargetsFromEntry(entryName: string): string[] {
  const targets: string[] = [];
  const regex = new RegExp(EXTENSION_REPLACEMENT_PATTERN.source, 'g');
  let match;
  while ((match = regex.exec(entryName)) !== null) {
    targets.push(match[1]);
  }
  return targets;
}

/**
 * 从条目名称中提取所有前置需求
 * @param entryName 条目名称，如 "[扩展][xxx][<前置扩展]..."
 * @returns 前置需求数组
 */
function extractPrerequisiteTargetsFromEntry(entryName: string): string[] {
  const targets: string[] = [];
  const regex = new RegExp(EXTENSION_PREREQUISITE_PATTERN.source, 'g');
  let match;
  while ((match = regex.exec(entryName)) !== null) {
    targets.push(match[1]);
  }
  return targets;
}

/**
 * 从扩展条目数组中提取所有互斥目标（合并所有条目的标记并去重）
 * @param entries 扩展下的所有条目
 * @returns 互斥目标数组
 */
function extractExtensionExclusionTargets(entries: ExtensionEntry[]): string[] {
  const allTargets = new Set<string>();
  for (const entry of entries) {
    const targets = extractExclusionTargetsFromEntry(entry.name);
    targets.forEach(t => allTargets.add(t));
  }
  return Array.from(allTargets);
}

/**
 * 从扩展条目数组中提取所有替换目标（合并所有条目的标记并去重）
 * @param entries 扩展下的所有条目
 * @returns 替换目标数组
 */
function extractExtensionReplacementTargets(entries: ExtensionEntry[]): string[] {
  const allTargets = new Set<string>();
  for (const entry of entries) {
    const targets = extractReplacementTargetsFromEntry(entry.name);
    targets.forEach(t => allTargets.add(t));
  }
  return Array.from(allTargets);
}

/**
 * 从扩展条目数组中提取所有前置需求（合并所有条目的标记并去重）
 * @param entries 扩展下的所有条目
 * @returns 前置需求数组
 */
function extractExtensionPrerequisiteTargets(entries: ExtensionEntry[]): string[] {
  const allTargets = new Set<string>();
  for (const entry of entries) {
    const targets = extractPrerequisiteTargetsFromEntry(entry.name);
    targets.forEach(t => allTargets.add(t));
  }
  return Array.from(allTargets);
}

/**
 * 从扩展条目中提取作者和信息
 * @param entries 扩展下的所有条目
 * @returns { author: string, info: string }
 */
function extractExtensionAuthorInfo(entries: ExtensionEntry[]): { author: string; info: string } {
  for (const entry of entries) {
    const match = entry.name.match(AUTHOR_PATTERN);
    if (match) {
      const authorInfo = match[1].trim();
      const dashIndex = authorInfo.indexOf('-');
      if (dashIndex > 0) {
        return {
          author: authorInfo.substring(0, dashIndex).trim(),
          info: authorInfo.substring(dashIndex + 1).trim(),
        };
      }
      return { author: authorInfo, info: '' };
    }
  }
  return { author: '', info: '' };
}

/**
 * 加载扩展列表
 */
export async function loadExtensionOptions(): Promise<{
  extensionOptions: ExtensionOption[];
  localExtensionSelections: Map<string, boolean>;
  bookName: string | null;
}> {
  const bookName = getWorldBookName();
  const entries = await getFilteredEntries(EXTENSION_PATTERN, bookName);

  // 按扩展Key分组条目
  const extensionGroups = new Map<string, ExtensionEntry[]>();

  for (const entry of entries as { name: string; enabled: boolean }[]) {
    const extensionKey = extractExtensionKey(entry.name);
    if (!extensionKey) continue;

    if (!extensionGroups.has(extensionKey)) {
      extensionGroups.set(extensionKey, []);
    }
    extensionGroups.get(extensionKey)!.push({
      name: entry.name,
      enabled: entry.enabled,
    });
  }

  // 构建扩展选项列表
  const extensionOptions: ExtensionOption[] = [];
  for (const [extensionKey, groupEntries] of extensionGroups) {
    // 扩展启用状态：所有条目都启用时为true
    const allEnabled = groupEntries.every(e => e.enabled);
    const { author, info } = extractExtensionAuthorInfo(groupEntries);
    extensionOptions.push({
      extensionKey,
      label: extractExtensionLabel(extensionKey),
      author,
      info,
      exclusionTargets: extractExtensionExclusionTargets(groupEntries),
      replacementTargets: extractExtensionReplacementTargets(groupEntries),
      prerequisiteTargets: extractExtensionPrerequisiteTargets(groupEntries),
      entries: groupEntries,
      enabled: allEnabled,
    });
  }

  // 对扩展选项进行排序（按拼音首字母）
  const sortedExtensionOptions = sortExtensionOptions(extensionOptions);

  // 初始化本地选择列表（从分组状态复制）
  const localExtensionSelections = new Map(
    sortedExtensionOptions.map(ext => [ext.extensionKey, ext.enabled]),
  );

  return { extensionOptions: sortedExtensionOptions, localExtensionSelections, bookName };
}

/**
 * 检查前置需求是否满足
 * @param extensionOptions 扩展选项列表
 * @param localExtensionSelections 本地选择状态
 * @param prerequisiteTargets 前置需求目标数组
 * @returns { satisfied: boolean, missingPrerequisites: string[] }
 */
function checkPrerequisites(
  extensionOptions: ExtensionOption[],
  localExtensionSelections: Map<string, boolean>,
  prerequisiteTargets: string[],
): { satisfied: boolean; missingPrerequisites: string[] } {
  const missingPrerequisites: string[] = [];

  for (const target of prerequisiteTargets) {
    // 查找包含 [target] 的扩展
    const prerequisiteExtension = extensionOptions.find(ext =>
      ext.extensionKey.includes(`[${target}]`),
    );
    if (prerequisiteExtension) {
      const isEnabled = localExtensionSelections.get(prerequisiteExtension.extensionKey) ?? false;
      if (!isEnabled) {
        missingPrerequisites.push(target);
      }
    } else {
      // 如果找不到对应的扩展，记录为缺失
      missingPrerequisites.push(target);
    }
  }

  return {
    satisfied: missingPrerequisites.length === 0,
    missingPrerequisites,
  };
}

/**
 * 切换扩展启用状态的结果
 */
export interface ToggleExtensionResult {
  selections: Map<string, boolean>;
  success: boolean;
  error?: string;
  missingPrerequisites?: string[];
}

/**
 * 切换扩展启用状态（更新本地状态，返回新的选择Map和结果状态）
 *
 * 处理三种关系：
 * 1. 互斥 [!xxx]：开启时关闭包含 [xxx] 的扩展（扩展之间互斥）
 * 2. 替换 [>xxx]：开启时关闭包含 [xxx] 的条目，关闭时无特殊处理（保存时处理恢复）
 * 3. 前置需求 [<xxx]：开启时检查 [xxx] 扩展是否已开启
 */
export function toggleExtension(
  localExtensionSelections: Map<string, boolean>,
  extensionOptions: ExtensionOption[],
  extensionKey: string,
): ToggleExtensionResult {
  const newSelections = new Map(localExtensionSelections);
  const currentEnabled = newSelections.get(extensionKey) ?? false;
  const newEnabled = !currentEnabled;

  const targetExtension = extensionOptions.find(ext => ext.extensionKey === extensionKey);

  // 如果正在启用扩展，需要检查前置需求
  if (newEnabled && targetExtension) {
    // 检查前置需求
    if (targetExtension.prerequisiteTargets.length > 0) {
      const { satisfied, missingPrerequisites } = checkPrerequisites(
        extensionOptions,
        newSelections,
        targetExtension.prerequisiteTargets,
      );

      if (!satisfied) {
        return {
          selections: localExtensionSelections, // 返回原始选择，不做改变
          success: false,
          error: `缺少前置需求: ${missingPrerequisites.join(', ')}`,
          missingPrerequisites,
        };
      }
    }
  }

  newSelections.set(extensionKey, newEnabled);

  // 如果正在启用扩展，处理互斥逻辑
  if (newEnabled && targetExtension) {
    // 处理互斥目标
    for (const exclusionTarget of targetExtension.exclusionTargets) {
      // 查找所有包含 [互斥目标] 的扩展并禁用
      for (const ext of extensionOptions) {
        // 检查扩展label是否匹配互斥目标，或扩展Key是否包含 [互斥目标]
        if (
          ext.extensionKey !== extensionKey &&
          (ext.label === exclusionTarget || ext.extensionKey.includes(`[${exclusionTarget}]`))
        ) {
          newSelections.set(ext.extensionKey, false);
        }
      }
    }
  }

  // 如果正在禁用扩展，检查是否有其他扩展依赖此扩展作为前置需求
  if (!newEnabled && targetExtension) {
    // 查找所有依赖当前扩展的扩展并禁用它们
    for (const ext of extensionOptions) {
      if (ext.extensionKey !== extensionKey) {
        const isEnabled = newSelections.get(ext.extensionKey) ?? false;
        if (isEnabled && ext.prerequisiteTargets.includes(targetExtension.label)) {
          // 递归禁用依赖此扩展的扩展
          newSelections.set(ext.extensionKey, false);
        }
      }
    }
  }

  return {
    selections: newSelections,
    success: true,
  };
}

/**
 * 检查本地扩展选择是否与原始状态有变化
 */
export function hasExtensionChanges(
  extensionOptions: ExtensionOption[],
  localExtensionSelections: Map<string, boolean>,
): boolean {
  for (const ext of extensionOptions) {
    const localEnabled = localExtensionSelections.get(ext.extensionKey) ?? false;
    if (localEnabled !== ext.enabled) {
      return true;
    }
  }
  return false;
}

/**
 * 收集所有被启用扩展的互斥目标（需要禁用的目标）
 * @param extensionOptions 扩展选项列表
 * @param localExtensionSelections 本地选择状态
 * @returns 互斥目标数组
 */
function collectExclusionTargetsToDisable(
  extensionOptions: ExtensionOption[],
  localExtensionSelections: Map<string, boolean>,
): string[] {
  const exclusionTargets: string[] = [];

  for (const ext of extensionOptions) {
    const isEnabled = localExtensionSelections.get(ext.extensionKey) ?? false;
    if (isEnabled && ext.exclusionTargets.length > 0) {
      exclusionTargets.push(...ext.exclusionTargets);
    }
  }

  // 去重
  return [...new Set(exclusionTargets)];
}

/**
 * 收集所有被启用扩展的替换目标（需要禁用的条目）
 * @param extensionOptions 扩展选项列表
 * @param localExtensionSelections 本地选择状态
 * @returns 替换目标数组
 */
function collectReplacementTargetsToDisable(
  extensionOptions: ExtensionOption[],
  localExtensionSelections: Map<string, boolean>,
): string[] {
  const replacementTargets: string[] = [];

  for (const ext of extensionOptions) {
    const isEnabled = localExtensionSelections.get(ext.extensionKey) ?? false;
    if (isEnabled && ext.replacementTargets.length > 0) {
      replacementTargets.push(...ext.replacementTargets);
    }
  }

  // 去重
  return [...new Set(replacementTargets)];
}

/**
 * 收集所有被禁用扩展的替换目标（需要恢复启用的条目）
 * @param extensionOptions 扩展选项列表
 * @param localExtensionSelections 本地选择状态
 * @param originalExtensionStates 原始扩展状态（用于判断扩展是否从启用变为禁用）
 * @returns 替换目标数组
 */
function collectReplacementTargetsToEnable(
  extensionOptions: ExtensionOption[],
  localExtensionSelections: Map<string, boolean>,
  originalExtensionStates: Map<string, boolean>,
): string[] {
  const replacementTargets: string[] = [];

  for (const ext of extensionOptions) {
    const isEnabled = localExtensionSelections.get(ext.extensionKey) ?? false;
    const wasEnabled = originalExtensionStates.get(ext.extensionKey) ?? false;

    // 只有当扩展从启用变为禁用时，才恢复替换目标
    if (!isEnabled && wasEnabled && ext.replacementTargets.length > 0) {
      replacementTargets.push(...ext.replacementTargets);
    }
  }

  // 去重
  return [...new Set(replacementTargets)];
}

/**
 * 保存扩展选择到世界书
 * @param extensionOptions 扩展选项列表
 * @param localExtensionSelections 本地选择状态
 * @param bookName 世界书名称
 * @returns 更新后的扩展选项列表
 */
export async function saveExtensionChanges(
  extensionOptions: ExtensionOption[],
  localExtensionSelections: Map<string, boolean>,
  bookName: string,
): Promise<ExtensionOption[]> {
  if (!hasExtensionChanges(extensionOptions, localExtensionSelections)) {
    return extensionOptions;
  }

  // 构建原始扩展状态映射
  const originalExtensionStates = new Map(
    extensionOptions.map(ext => [ext.extensionKey, ext.enabled]),
  );

  // 构建更新列表：将每个扩展的所有条目设置为相同的启用状态
  const updatedEntries: Array<{ name: string; enabled: boolean }> = [];

  for (const ext of extensionOptions) {
    const newEnabled = localExtensionSelections.get(ext.extensionKey) ?? false;
    for (const entry of ext.entries) {
      updatedEntries.push({
        name: entry.name,
        enabled: newEnabled,
      });
    }
  }

  // 收集所有被启用扩展的互斥目标（需要禁用）
  const exclusionTargetsToDisable = collectExclusionTargetsToDisable(
    extensionOptions,
    localExtensionSelections,
  );

  // 收集所有被启用扩展的替换目标（需要禁用）
  const replacementTargetsToDisable = collectReplacementTargetsToDisable(
    extensionOptions,
    localExtensionSelections,
  );

  // 收集所有被禁用扩展的替换目标（需要恢复启用）
  const replacementTargetsToEnable = collectReplacementTargetsToEnable(
    extensionOptions,
    localExtensionSelections,
    originalExtensionStates,
  );

  // 从需要启用的替换目标中排除需要禁用的目标（禁用优先级更高）
  const filteredReplacementTargetsToEnable = replacementTargetsToEnable.filter(
    target =>
      !replacementTargetsToDisable.includes(target) && !exclusionTargetsToDisable.includes(target),
  );

  // 处理互斥逻辑：禁用包含 [互斥目标] 的扩展条目
  if (exclusionTargetsToDisable.length > 0) {
    for (const target of exclusionTargetsToDisable) {
      const pattern = new RegExp(`\\[${escapeRegExp(target)}\\]`);
      const matchingEntries = await getFilteredEntries(pattern, bookName);

      for (const entry of matchingEntries as { name: string; enabled: boolean }[]) {
        // 检查是否已经在更新列表中
        const existingIndex = updatedEntries.findIndex(e => e.name === entry.name);
        if (existingIndex === -1) {
          updatedEntries.push({
            name: entry.name,
            enabled: false,
          });
        } else {
          // 如果已存在，确保设置为禁用
          updatedEntries[existingIndex].enabled = false;
        }
      }
    }
  }

  // 处理替换逻辑（禁用）：禁用包含 [替换目标] 的条目
  if (replacementTargetsToDisable.length > 0) {
    for (const target of replacementTargetsToDisable) {
      const pattern = new RegExp(`\\[${escapeRegExp(target)}\\]`);
      const matchingEntries = await getFilteredEntries(pattern, bookName);

      for (const entry of matchingEntries as { name: string; enabled: boolean }[]) {
        // 检查是否已经在更新列表中
        const existingIndex = updatedEntries.findIndex(e => e.name === entry.name);
        if (existingIndex === -1) {
          updatedEntries.push({
            name: entry.name,
            enabled: false,
          });
        } else {
          // 如果已存在，确保设置为禁用（替换目标禁用优先级高）
          updatedEntries[existingIndex].enabled = false;
        }
      }
    }
  }

  // 处理替换逻辑（恢复启用）：启用包含 [替换目标] 的条目（当扩展关闭时）
  if (filteredReplacementTargetsToEnable.length > 0) {
    for (const target of filteredReplacementTargetsToEnable) {
      const pattern = new RegExp(`\\[${escapeRegExp(target)}\\]`);
      const matchingEntries = await getFilteredEntries(pattern, bookName);

      for (const entry of matchingEntries as { name: string; enabled: boolean }[]) {
        // 检查是否已经在更新列表中
        const existingIndex = updatedEntries.findIndex(e => e.name === entry.name);
        if (existingIndex === -1) {
          updatedEntries.push({
            name: entry.name,
            enabled: true,
          });
        } else if (updatedEntries[existingIndex].enabled !== false) {
          // 如果已存在且不是被禁用的目标，则启用
          // 注意：禁用的优先级更高，所以这里不覆盖已禁用的条目
          updatedEntries[existingIndex].enabled = true;
        }
      }
    }
  }

  await updateWorldBook(updatedEntries, bookName);

  // 返回更新后的扩展选项列表
  return extensionOptions.map(ext => {
    const newEnabled = localExtensionSelections.get(ext.extensionKey) ?? false;
    return {
      ...ext,
      enabled: newEnabled,
      entries: ext.entries.map(entry => ({
        ...entry,
        enabled: newEnabled,
      })),
    };
  });
}

/**
 * 辅助函数：转义正则表达式特殊字符
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
