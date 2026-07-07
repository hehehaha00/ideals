// 这个文件组合脑洞实验室 MVP 的完整工作台页面。
import { AppShell } from "./components/layout/AppShell";
import { Panel } from "./components/ui/Panel";
import { CollisionTray } from "./components/workbench/CollisionTray";
import { DimensionBoard } from "./components/workbench/DimensionBoard";
import { FavoriteDock } from "./components/workbench/FavoriteDock";
import { IdeaCardList } from "./components/workbench/IdeaCardList";
import { TopicComposer } from "./components/workbench/TopicComposer";
import { TransformerPanel } from "./components/workbench/TransformerPanel";
import { useIdeaStore } from "./store/ideaStore";

// 渲染 MVP 主界面。
function App(): JSX.Element {
  const error = useIdeaStore((state) => state.error);
  const streamText = useIdeaStore((state) => state.streamText);

  return (
    <AppShell
      left={
        <>
          <Panel eyebrow="Session" title="当前会话">
            <p className="text-sm leading-6 text-ink-500">单次发散</p>
          </Panel>
          <FavoriteDock />
        </>
      }
      center={
        <>
          <TopicComposer />
          {error && <div className="rounded-lg border border-amber-600 bg-yellow-100 p-3 text-sm text-ink-900">{error}</div>}
          {streamText && <div className="rounded-lg border border-line-100 bg-paper-0 p-3 text-sm leading-6 text-ink-700">正在接收灵感流：{streamText}</div>}
          <DimensionBoard />
          <CollisionTray />
          <IdeaCardList />
        </>
      }
      right={<TransformerPanel />}
    />
  );
}

export default App;
