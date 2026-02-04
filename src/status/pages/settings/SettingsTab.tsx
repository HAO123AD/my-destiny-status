import { FC } from 'react';
import { ThemeList } from '../../config/theme-presets';
import { useEditorSettingStore, useThemeStore } from '../../core/stores';
import { Card } from '../../shared/components';
import { ToggleEditor } from '../../shared/components/editors/ToggleEditor/ToggleEditor';
import styles from './SettingsTab.module.scss';

/**
 * 设置页组件
 */
export const SettingsTab: FC = () => {
  const { currentThemeId, setTheme, reset, saveTheme } = useThemeStore();
  const { editEnabled, setEditEnabled, saveSettings } = useEditorSettingStore();

  const handleToggle = async (next: boolean) => {
    setEditEnabled(next);
    await saveSettings();
    toastr.success(next ? '已启用编辑' : '已关闭编辑');
  };

  /** 处理主题变化 */
  const handleThemeChange = (themeId: string) => {
    setTheme(themeId as any);
  };

  /** 处理保存 */
  const handleSave = async () => {
    await saveTheme();
    toastr.success('主题已保存');
  };

  /** 处理重置 */
  const handleReset = async () => {
    await reset();
    toastr.info('已恢复默认主题');
  };

  return (
    <div className={styles.settingsTab}>
      {/* 编辑设置 */}
      <div className={styles.editSettingBar}>
        <span className={styles.editSettingLabel}>允许编辑数据</span>
        <ToggleEditor
          value={editEnabled}
          onChange={handleToggle}
          labelOff="关闭"
          labelOn="开启"
          size="sm"
        />
      </div>

      <Card title="主题设置" className={styles.settingsTabTheme}>
        <div className={styles.themeSelector}>
          <div className={styles.themeSelectorLabel}>选择主题</div>
          <div className={styles.themeOptions}>
            {ThemeList.map(theme => (
              <button
                key={theme.id}
                className={`${styles.themeOption} ${currentThemeId === theme.id ? styles.themeOptionActive : ''}`}
                onClick={() => handleThemeChange(theme.id)}
              >
                <span className={styles.themePreview} data-theme={theme.id} />
                <span className={styles.themeName}>{theme.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.themeActions}>
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleReset}>
            恢复默认
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            保存主题
          </button>
        </div>
      </Card>
    </div>
  );
};
