import { FC, ReactNode } from 'react';
import { useDeleteConfirm } from '../../core/hooks';
import { useEditorSettingStore } from '../../core/stores';
import { sortEntriesByQuality } from '../../core/utils';
import {
  Ascension,
  Card,
  Collapse,
  DeleteConfirmModal,
  EditableField,
  EmptyHint,
  IconTitle,
  ItemDetail,
} from '../../shared/components';
import { withMvuData, WithMvuDataProps } from '../../shared/hoc';
import styles from './DestinyTab.module.scss';

/** 字段类型 */
type FieldType = 'text' | 'number' | 'textarea' | 'tags' | 'toggle' | 'keyvalue';

/**
 * 命定页内容组件
 */
const DestinyTabContent: FC<WithMvuDataProps> = ({ data }) => {
  const editEnabled = useEditorSettingStore(state => state.editEnabled);
  const { deleteTarget, setDeleteTarget, handleDelete, cancelDelete, isConfirmOpen } =
    useDeleteConfirm();
  const destinySystem = data.命定系统;
  const partners = destinySystem?.关系列表;

  /**
   * 处理 FP 商店按钮点击
   * 发送用户消息"打开FP商店"并触发 AI 回复
   */
  const handleOpenFpShop = async () => {
    // 发送用户消息
    await createChatMessages([{ role: 'user', message: '打开FP商店' }]);
    // 触发 AI 回复
    await triggerSlash('/trigger');
  };

  /**
   * 渲染可编辑字段行
   * 非编辑模式：保持原有布局
   * 编辑模式：替换为 EditableField
   */
  const renderEditableRow = (
    label: string,
    path: string,
    value: string | number | boolean | string[] | Record<string, any> | undefined,
    type: FieldType,
    rowClass: string,
    labelClass: string,
    valueClass: string,
    config?: {
      numberConfig?: { min?: number; max?: number; step?: number };
      toggleConfig?: { labelOff?: string; labelOn?: string; size?: 'sm' | 'md' };
    },
  ) => {
    // 非编辑模式：空值不显示
    if (!editEnabled && (value === undefined || value === null || value === '')) return null;

    // 格式化显示值
    const formatDisplayValue = () => {
      if (value === undefined || value === null) return '无';
      if (type === 'tags' && Array.isArray(value)) {
        return value.length > 0 ? value.join(' / ') : '无';
      }
      if (type === 'toggle') return value ? '是' : '否';
      if (value === '') return '无';
      return String(value);
    };

    return (
      <div className={rowClass}>
        <span className={labelClass}>{label}</span>
        {editEnabled ? (
          <EditableField
            path={path}
            value={
              value ??
              (type === 'number' ? 0 : type === 'toggle' ? false : type === 'tags' ? [] : '')
            }
            type={type}
            {...config}
          />
        ) : (
          <span className={valueClass}>{formatDisplayValue()}</span>
        )}
      </div>
    );
  };

  /**
   * 渲染只读字段行（等级/生命层级等不可编辑字段）
   */
  const renderReadonlyRow = (
    label: string,
    value: string | number | undefined,
    rowClass: string,
    labelClass: string,
    valueClass: string,
  ) => {
    if (value === undefined || value === null || value === '') return null;
    return (
      <div className={rowClass}>
        <span className={labelClass}>{label}</span>
        <span className={valueClass}>{value}</span>
      </div>
    );
  };

  const renderAffectionBar = (value: number) => {
    const percentage = Math.abs(value);
    const isNegative = value < 0;

    return (
      <div className={styles.affectionBar}>
        <div className={styles.affectionBarTrack}>
          <div
            className={`${styles.affectionBarFill} ${isNegative ? styles.isNegative : ''}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={`${styles.affectionBarValue} ${isNegative ? styles.isNegative : ''}`}>
          {value}
        </span>
      </div>
    );
  };

  const renderItemSection = (
    title: string,
    items: Record<string, any> | undefined,
    listClassName: string,
    getTitleSuffix: (item: any) => ReactNode,
    partnerName: string,
  ) => {
    if (_.isEmpty(items)) return null;

    const itemType = title === '装备' ? '装备' : '技能';
    const itemCategory = title === '装备' ? 'equipment' : 'skill';

    return (
      <div className={title === '装备' ? styles.partnerEquipment : styles.partnerSkills}>
        <div className={styles.sectionLabel}>{title}</div>
        <div className={listClassName}>
          {sortEntriesByQuality(items).map(([name, item]) => (
            <ItemDetail
              key={name}
              name={name}
              data={item}
              titleSuffix={getTitleSuffix(item)}
              editEnabled={editEnabled}
              pathPrefix={`命定系统.关系列表.${partnerName}.${itemType}.${name}`}
              onDelete={() =>
                setDeleteTarget({
                  type: itemType,
                  path: `命定系统.关系列表.${partnerName}.${itemType}.${name}`,
                  name,
                })
              }
              itemCategory={itemCategory}
            />
          ))}
        </div>
      </div>
    );
  };

  /** 渲染关系列表 */
  const renderPartners = () => {
    if (_.isEmpty(partners)) {
      return <EmptyHint className={styles.emptyHint} text="暂无伙伴" />;
    }

    return (
      <div className={styles.partnerList}>
        {_.map(partners, (partner, name) => (
          <Collapse
            key={name}
            title={
              <div className={styles.partnerTitle}>
                <IconTitle text={name} className={styles.partnerName} />
                <div className={styles.partnerMeta}>
                  <span className={styles.affectionBadge}>好感度 {partner.好感度 ?? 0}</span>
                  <div className={styles.partnerTags}>
                    {partner.在场 && (
                      <span className={`${styles.tag} ${styles.tagPresent}`}>在场</span>
                    )}
                    {partner.命定契约 && (
                      <span className={`${styles.tag} ${styles.tagContract}`}>命定契约</span>
                    )}
                  </div>
                </div>
                {editEnabled && (
                  <button
                    className={styles.deletePartnerBtn}
                    onClick={e => {
                      e.stopPropagation();
                      setDeleteTarget({
                        type: '伙伴',
                        path: `命定系统.关系列表.${name}`,
                        name,
                      });
                    }}
                    title="删除关系"
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                )}
              </div>
            }
          >
            <div className={styles.partnerDetails}>
              {/* 好感度 - 可编辑 */}
              <div className={styles.partnerAffection}>
                <span className={styles.label}>好感度</span>
                {editEnabled ? (
                  <EditableField
                    path={`命定系统.关系列表.${name}.好感度`}
                    value={partner.好感度 ?? 0}
                    type="number"
                    numberConfig={{ min: -100, max: 100, step: 1 }}
                  />
                ) : (
                  renderAffectionBar(partner.好感度 ?? 0)
                )}
              </div>

              {/* 状态标签（在场、命定契约）- 编辑模式显示开关 */}
              {editEnabled && (
                <div className={styles.partnerStatusToggles}>
                  <div className={styles.toggleRow}>
                    <span className={styles.toggleLabel}>在场状态</span>
                    <EditableField
                      path={`命定系统.关系列表.${name}.在场`}
                      value={partner.在场 ?? false}
                      type="toggle"
                      toggleConfig={{ labelOff: '离场', labelOn: '在场', size: 'sm' }}
                    />
                  </div>
                  <div className={styles.toggleRow}>
                    <span className={styles.toggleLabel}>命定契约</span>
                    <EditableField
                      path={`命定系统.关系列表.${name}.命定契约`}
                      value={partner.命定契约 ?? false}
                      type="toggle"
                      toggleConfig={{ labelOff: '未缔结', labelOn: '已缔结', size: 'sm' }}
                    />
                  </div>
                </div>
              )}

              {/* 基础信息（性别始终显示以便区分男女） */}
              <div className={styles.partnerInfo}>
                {(partner.性别 !== undefined && partner.性别 !== '') || editEnabled ? (
                  renderEditableRow(
                    '性别',
                    `命定系统.关系列表.${name}.性别`,
                    partner.性别,
                    'text',
                    styles.infoRow,
                    styles.infoLabel,
                    styles.infoValue,
                  )
                ) : (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>性别</span>
                    <span className={styles.infoValue}>未设定</span>
                  </div>
                )}
                {renderEditableRow(
                  '种族',
                  `命定系统.关系列表.${name}.种族`,
                  partner.种族,
                  'text',
                  styles.infoRow,
                  styles.infoLabel,
                  styles.infoValue,
                )}
                {renderEditableRow(
                  '身份',
                  `命定系统.关系列表.${name}.身份`,
                  partner.身份,
                  'tags',
                  styles.infoRow,
                  styles.infoLabel,
                  styles.infoValue,
                )}
                {renderEditableRow(
                  '职业',
                  `命定系统.关系列表.${name}.职业`,
                  partner.职业,
                  'tags',
                  styles.infoRow,
                  styles.infoLabel,
                  styles.infoValue,
                )}
                {renderReadonlyRow(
                  '生命层级',
                  partner.生命层级,
                  styles.infoRow,
                  styles.infoLabel,
                  styles.infoValue,
                )}
                {renderReadonlyRow(
                  '等级',
                  partner.等级 ? `Lv.${partner.等级}` : '',
                  styles.infoRow,
                  styles.infoLabel,
                  styles.infoValue,
                )}
              </div>

              {/* 外貌与着装：外貌=简要表面描述；身体状态=各部位细节单独列出 */}
              <div className={styles.partnerAppearance}>
                {/* 外貌：简要表面描述，无内容且非编辑时也显示一行「无」 */}
                {(partner.外貌 !== undefined && partner.外貌 !== '') || editEnabled ? (
                  renderEditableRow(
                    '外貌',
                    `命定系统.关系列表.${name}.外貌`,
                    partner.外貌,
                    'textarea',
                    styles.appearanceRow,
                    styles.appearanceLabel,
                    styles.appearanceValue,
                  )
                ) : (
                  <div className={styles.appearanceRow}>
                    <span className={styles.appearanceLabel}>外貌</span>
                    <span className={styles.appearanceValue}>无</span>
                  </div>
                )}
                {/* 身体状态：各部位单独列出（胸部、腹部、阴部、臀部、腿部等） */}
                <Collapse title="身体状态" className={styles.appearanceCollapse}>
                  <div className={styles.bodyStateContent}>
                    {partner.身体情况 &&
                    typeof partner.身体情况 === 'object' &&
                    Object.keys(partner.身体情况).length > 0 ? (
                      _.map(partner.身体情况, (desc, partName) => (
                        <div key={partName} className={styles.bodyStateRow}>
                          <span className={styles.bodyStateLabel}>{partName}</span>
                          <span className={styles.bodyStateValue}>{desc || '—'}</span>
                        </div>
                      ))
                    ) : (
                      <span className={styles.hiddenEntryPlaceholder}>（暂无身体状态）</span>
                    )}
                  </div>
                </Collapse>
                {/* 着装：同上，无内容且非编辑时也显示「无」 */}
                {(partner.着装 !== undefined && partner.着装 !== '') || editEnabled ? (
                  renderEditableRow(
                    '着装',
                    `命定系统.关系列表.${name}.着装`,
                    partner.着装,
                    'textarea',
                    styles.appearanceRow,
                    styles.appearanceLabel,
                    styles.appearanceValue,
                  )
                ) : (
                  <div className={styles.appearanceRow}>
                    <span className={styles.appearanceLabel}>着装</span>
                    <span className={styles.appearanceValue}>无</span>
                  </div>
                )}
              </div>

              {/* 性格特征 */}
              {(partner.性格 || partner.喜爱 || editEnabled) && (
                <div className={styles.partnerTraits}>
                  {renderEditableRow(
                    '性格',
                    `命定系统.关系列表.${name}.性格`,
                    partner.性格,
                    'textarea',
                    styles.traitRow,
                    styles.traitLabel,
                    styles.traitValue,
                  )}
                  {renderEditableRow(
                    '喜爱',
                    `命定系统.关系列表.${name}.喜爱`,
                    partner.喜爱,
                    'textarea',
                    styles.traitRow,
                    styles.traitLabel,
                    styles.traitValue,
                  )}
                </div>
              )}

              {/* 属性 */}
              {!_.isEmpty(partner.属性) && (
                <div className={styles.partnerAttributes}>
                  <div className={styles.sectionLabel}>属性</div>
                  <div
                    className={`${styles.attributeGrid} ${editEnabled ? styles.attributeGridEdit : ''}`}
                  >
                    {_.map(partner.属性, (value, key) => (
                      <div
                        key={key}
                        className={`${styles.attributeItem} ${editEnabled ? styles.attributeItemEdit : ''}`}
                      >
                        <span className={styles.attributeKey}>{key}</span>
                        {editEnabled ? (
                          <EditableField
                            path={`命定系统.关系列表.${name}.属性.${key}`}
                            value={value ?? 0}
                            type="number"
                            numberConfig={{ min: 0, max: 20, step: 1 }}
                          />
                        ) : (
                          <span className={styles.attributeValue}>{value}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 装备 */}
              {renderItemSection(
                '装备',
                partner.装备,
                styles.equipmentList,
                item =>
                  item.位置 ? <span className={styles.equipmentSlot}>[{item.位置}]</span> : null,
                name,
              )}

              {/* 技能 */}
              {renderItemSection(
                '技能',
                partner.技能,
                styles.skillList,
                item => (item.消耗 ? <span className={styles.skillCost}>{item.消耗}</span> : null),
                name,
              )}

              {/* 心里话 */}
              {(partner.心里话 || editEnabled) && (
                <div className={styles.partnerThoughts}>
                  {renderEditableRow(
                    '心里话',
                    `命定系统.关系列表.${name}.心里话`,
                    partner.心里话,
                    'textarea',
                    styles.thoughtsRow,
                    styles.thoughtsLabel,
                    styles.thoughtsContent,
                  )}
                </div>
              )}

              {/* 背景故事 */}
              {(partner.背景故事 || editEnabled) && (
                <div className={styles.partnerBackground}>
                  {renderEditableRow(
                    '背景故事',
                    `命定系统.关系列表.${name}.背景故事`,
                    partner.背景故事,
                    'textarea',
                    styles.backgroundRow,
                    styles.backgroundLabel,
                    styles.backgroundContent,
                  )}
                </div>
              )}

              {/* 登神长阶 */}
              {partner.登神长阶?.是否开启 && (
                <div className={styles.partnerAscension}>
                  <div className={styles.ascensionLabel}>登神长阶</div>
                  <Ascension
                    data={partner.登神长阶}
                    compact
                    editEnabled={editEnabled}
                    pathPrefix={`命定系统.关系列表.${name}.登神长阶`}
                  />
                </div>
              )}
            </div>
          </Collapse>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.destinyTab}>
      {/* FP商店按钮（暂时禁用，待正式上线） */}
      <button className={styles.fpShopBtn} onClick={handleOpenFpShop} disabled title="待上线">
        <i className="fa-solid fa-store" />
        <span>FP商店</span>
        <span className={styles.comingSoonBadge}>待上线</span>
      </button>

      {/* 命运点数 */}
      <Card className={styles.destinyTabPoints}>
        <div className={styles.destinyPoints}>
          <i className={`fa-solid fa-star ${styles.destinyPointsIcon}`} />
          <span className={styles.destinyPointsLabel}>命运点数</span>
          {editEnabled ? (
            <EditableField
              path="命定系统.命运点数"
              value={destinySystem?.命运点数 ?? 0}
              type="number"
              numberConfig={{ min: 0, step: 1 }}
            />
          ) : (
            <span className={styles.destinyPointsValue}>{destinySystem?.命运点数 ?? 0}</span>
          )}
        </div>
      </Card>

      {/* 关系列表 */}
      <Card title="伙伴" className={styles.destinyTabPartners}>
        {renderPartners()}
      </Card>

      {/* 删除确认弹窗 */}
      <DeleteConfirmModal
        open={isConfirmOpen}
        target={deleteTarget}
        onConfirm={handleDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

/**
 * 命定页组件（使用 HOC 包装）
 */
export const DestinyTab = withMvuData({ baseClassName: styles.destinyTab })(DestinyTabContent);
