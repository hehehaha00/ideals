// 这个文件展示多选节点的批量操作，避免主工具栏长期堆满按钮。
import { Check, FolderPlus, Lock, LockOpen, Ungroup, X } from "lucide-react";
import { useState, type FormEvent } from "react";

interface MindMapSelectionToolbarProps {
  count: number;
  disabled: boolean;
  groupedCount: number;
  selectedNodeIds: string[];
  onClear: () => void;
  onCreateGroup: (name: string, nodeIds: string[]) => void;
  onLock: (locked: boolean) => void;
  onUngroup: (nodeIds: string[]) => void;
}

export function MindMapSelectionToolbar({ count, disabled, groupedCount, selectedNodeIds, onClear, onCreateGroup, onLock, onUngroup }: MindMapSelectionToolbarProps): JSX.Element | null {
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  if (count < 2) return null;

  const trimmedGroupName = groupName.trim();
  const groupError = count < 2 ? "至少选择 2 个节点" : trimmedGroupName ? undefined : "请输入分组名称";

  // 只有名称和成员都有效时才提交，成功后恢复紧凑工具条。
  function submitGroup(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (disabled || groupError) return;
    onCreateGroup(trimmedGroupName, selectedNodeIds);
    setGroupName("");
    setGroupEditorOpen(false);
  }

  return (
    <div className="mindmap-selection-toolbar" aria-label="批量节点操作">
      <button disabled={disabled} type="button" onClick={() => onLock(true)}><Lock className="h-3.5 w-3.5" aria-hidden="true" />批量锁定</button>
      <button disabled={disabled} type="button" onClick={() => onLock(false)}><LockOpen className="h-3.5 w-3.5" aria-hidden="true" />批量解锁</button>
      {!groupEditorOpen && (
        <button disabled={disabled || count < 2} type="button" onClick={() => setGroupEditorOpen(true)}>
          <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />建立分组
        </button>
      )}
      {groupEditorOpen && (
        <form className="flex items-center gap-1" aria-label="建立节点分组" onSubmit={submitGroup}>
          <label className="sr-only" htmlFor="mindmap-group-name">分组名称</label>
          <input
            className="h-8 w-28 rounded-md border border-white/20 bg-black/30 px-2 text-xs text-[#fff7df] outline-none placeholder:text-white/40 focus:border-spark-500 focus:ring-1 focus:ring-spark-500 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={disabled}
            id="mindmap-group-name"
            maxLength={60}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="分组名称"
            value={groupName}
          />
          <button aria-label="确认建立分组" disabled={disabled || Boolean(groupError)} title={groupError ?? "确认建立分组"} type="submit"><Check className="h-4 w-4" aria-hidden="true" /></button>
          <button aria-label="取消建立分组" disabled={disabled} title="取消" type="button" onClick={() => { setGroupName(""); setGroupEditorOpen(false); }}><X className="h-4 w-4" aria-hidden="true" /></button>
          <span className="sr-only" role="status">{groupError ?? `将 ${count} 个节点建立分组`}</span>
        </form>
      )}
      {groupedCount > 0 && <button disabled={disabled} type="button" onClick={() => onUngroup(selectedNodeIds)}><Ungroup className="h-3.5 w-3.5" aria-hidden="true" />解组已选节点</button>}
      <button aria-label="清除节点选择" disabled={disabled} type="button" onClick={onClear}><X className="h-4 w-4" aria-hidden="true" /></button>
    </div>
  );
}
