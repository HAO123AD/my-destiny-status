/**
 * 可选列表通用逻辑 composable
 * 遵循 DRY 原则，抽取 ItemList 和 DestinedOneList 的通用逻辑
 */

/**
 * 可选项接口
 * 任何具有 name 和 cost 属性的对象都可以使用此 composable
 */
export interface SelectableItem {
  name: string;
  cost: number;
}

/**
 * 创建可选列表的通用逻辑
 * @param selectedItems 已选择项的 getter 函数
 * @param availablePoints 可用点数的 getter 函数
 */
export function useSelectableList<T extends SelectableItem>(
  selectedItems: () => T[],
  availablePoints: () => number,
) {
  /**
   * 检查项目是否已被选中
   * 使用 lodash 的 _.some 进行匹配
   */
  const isSelected = (item: T): boolean => {
    return _.some(selectedItems(), { name: item.name });
  };

  /**
   * 检查项目是否可以被选择（点数是否足够）
   */
  const canSelect = (item: T): boolean => {
    return availablePoints() >= item.cost;
  };

  /**
   * 检查项目是否被禁用
   * 已选择的项目不会被禁用，未选择且点数不足的项目会被禁用
   */
  const isDisabled = (item: T): boolean => {
    if (isSelected(item)) return false;
    return !canSelect(item);
  };

  return {
    isSelected,
    canSelect,
    isDisabled,
  };
}

/**
 * 创建折叠状态管理逻辑
 * 使用 VueUse 的 useSet 进行状态管理
 */
export function useExpandableCards() {
  const expandedCards = ref<Set<string>>(new Set());

  /**
   * 切换卡片的折叠状态
   */
  const toggleExpand = (name: string, event?: Event): void => {
    event?.stopPropagation();
    if (expandedCards.value.has(name)) {
      expandedCards.value.delete(name);
    } else {
      expandedCards.value.add(name);
    }
  };

  /**
   * 检查卡片是否展开
   */
  const isExpanded = (name: string): boolean => {
    return expandedCards.value.has(name);
  };

  /**
   * 展开所有卡片
   */
  const expandAll = (names: string[]): void => {
    names.forEach(name => expandedCards.value.add(name));
  };

  /**
   * 收起所有卡片
   */
  const collapseAll = (): void => {
    expandedCards.value.clear();
  };

  return {
    expandedCards,
    toggleExpand,
    isExpanded,
    expandAll,
    collapseAll,
  };
}
