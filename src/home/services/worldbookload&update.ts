//获取世界书名字
export function getWorldBookName() {
  const bookInfo = window.top?.TavernHelper.getCharWorldbookNames('current');
  const BookName = bookInfo ? bookInfo.primary : null;
  return BookName;
}
//获取条目
export async function getWorldbookEntries(bookName: string | null) {
  if (!bookName) {
    return;
  }
  const worldbook = await window.top?.TavernHelper.getWorldbook(bookName);
  if (!worldbook) {
    return;
  }
  return worldbook.map((entry: { name: string; enabled: boolean }) => ({
    name: entry.name,
    enabled: entry.enabled,
  }));
}
//使用正则筛选条目
export async function getFilteredEntries(pattern: RegExp, bookName: string | null) {
  const worldbook = await getWorldbookEntries(bookName);
  if (!worldbook || worldbook.length === 0) {
    return [];
  }
  return worldbook
    .filter((entry: { name: string }) => pattern.test(entry.name))
    .map((entry: { name: any; enabled: any }) => ({
      name: entry.name,
      enabled: entry.enabled,
    }));
}
/**
 * 更新世界书条目的启用状态
 *
 * @param entries 修改后的条目列表，包含 name 和 enabled 属性
 * @throws 如果没有绑定世界书或世界书不存在，将会抛出错误
 *
 * @example
 * // 更新世界书
 * await updateWorldBook(entries);
 */
export async function updateWorldBook(
  entries: Array<{ name: string; enabled: boolean }>,
  bookName: string,
): Promise<void> {
  if (!bookName) {
    return;
  }
  if (!bookName) {
    throw new Error('No worldbook bound to current character');
  }

  const enabledMap = new Map(entries.map(e => [e.name, e.enabled]));

  await window.top?.TavernHelper.updateWorldbookWith(bookName, worldbook => {
    return worldbook.map(entry => {
      const newEnabled = enabledMap.get(entry.name);
      if (newEnabled !== undefined) {
        return { ...entry, enabled: newEnabled };
      }
      return entry;
    });
  });
}
