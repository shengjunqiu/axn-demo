/**
 * 独立文书库页（侧栏「文书库」导航）：占据主内容区，不与对话/文书工作区分栏竞争。
 * 内容复用 DocCenterPanel view='library'；选择/生成文书后回到助理页并打开右侧文书工作区。
 * 全部数据为模拟数据。
 */
import DocCenterPanel from './DocCenterPanel';

export default function DocumentLibraryPage() {
  return (
    <div className="doc-library-page" data-testid="document-library-page">
      <DocCenterPanel view="library" />
    </div>
  );
}
