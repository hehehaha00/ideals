// 这个文件提供单节点的就地编辑面板，由导图画布传入节点和状态动作。
import { Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import type { MindNode } from "../../types/idea";

export interface MindMapContextPanelProps {
  node: MindNode;
  nodes: MindNode[];
  center: MindNode;
  onRename: (nodeId: string, label: string) => void;
  onUpdateNote: (nodeId: string, note: string) => void;
  onReparent: (nodeId: string, parentId: string) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
  disabled?: boolean;
}

// 收集后代节点，避免父节点选择器展示会造成环的选项。
function descendantIds(nodes: MindNode[], nodeId: string): Set<string> {
  const descendants = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of nodes) {
      if (candidate.parentId && (candidate.parentId === nodeId || descendants.has(candidate.parentId)) && !descendants.has(candidate.id)) {
        descendants.add(candidate.id);
        changed = true;
      }
    }
  }
  return descendants;
}

// 展示并提交当前节点的标题、备注和父节点编辑。
export function MindMapContextPanel({
  node,
  nodes,
  center,
  onRename,
  onUpdateNote,
  onReparent,
  onDelete,
  onClose,
  disabled = false,
}: MindMapContextPanelProps): JSX.Element {
  const isCenter = node.id === center.id || node.category === "中心";
  const [label, setLabel] = useState(node.label);
  const [note, setNote] = useState(node.note ?? "");
  const [parentId, setParentId] = useState(node.parentId ?? center.id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const unavailableParentIds = useMemo(() => {
    const ids = descendantIds(nodes, node.id);
    ids.add(node.id);
    return ids;
  }, [node.id, nodes]);
  const parentOptions = useMemo(() => {
    const uniqueNodes = new Map<string, MindNode>([[center.id, center], ...nodes.map((item) => [item.id, item] as const)]);
    return Array.from(uniqueNodes.values()).filter((candidate) => !unavailableParentIds.has(candidate.id));
  }, [center, nodes, unavailableParentIds]);

  useEffect(() => {
    setLabel(node.label);
    setNote(node.note ?? "");
    setParentId(node.parentId ?? center.id);
    setConfirmingDelete(false);
  }, [center.id, node.id, node.label, node.note, node.parentId]);

  // 只提交发生变化的字段，避免制造无意义撤销记录。
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (disabled || !label.trim()) return;
    if (label.trim() !== node.label) onRename(node.id, label);
    if (note.trim() !== (node.note ?? "")) onUpdateNote(node.id, note);
    if (!isCenter && parentId !== node.parentId) onReparent(node.id, parentId);
  }

  // Escape 优先退出危险确认态，再次按下才关闭整个面板。
  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (confirmingDelete) {
      setConfirmingDelete(false);
      return;
    }
    onClose();
  }

  return (
    <aside className="w-72 rounded-md border border-white/20 bg-[#161411]/95 p-4 text-[#fff7df] shadow-2xl backdrop-blur-xl" aria-label={`编辑节点 ${node.label}`}>
      <form aria-label="编辑节点" onKeyDown={handleKeyDown} onSubmit={submit}>
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <p className="text-xs text-white/60">节点编辑</p>
            <p className="mt-1 text-sm font-medium text-[#fff7df]">{node.category}</p>
          </div>
          <button aria-label="关闭节点编辑" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-spark-500" disabled={disabled} title="关闭" type="button" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <label className="mt-4 block text-xs text-white/70" htmlFor={`mind-node-label-${node.id}`}>
          节点标题
        </label>
        <input
          className="mt-2 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm text-[#fff7df] outline-none transition placeholder:text-white/40 focus:border-spark-500 focus:ring-1 focus:ring-spark-500"
          disabled={disabled}
          id={`mind-node-label-${node.id}`}
          maxLength={80}
          onChange={(event) => setLabel(event.target.value)}
          value={label}
        />

        <label className="mt-4 block text-xs text-white/70" htmlFor={`mind-node-note-${node.id}`}>
          节点备注
        </label>
        <textarea
          className="mt-2 min-h-24 w-full resize-y rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm leading-5 text-[#fff7df] outline-none transition placeholder:text-white/40 focus:border-spark-500 focus:ring-1 focus:ring-spark-500"
          disabled={disabled}
          id={`mind-node-note-${node.id}`}
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
          placeholder="记录判断、证据或下一步"
          value={note}
        />

        <label className="mt-4 block text-xs text-white/70" htmlFor={`mind-node-parent-${node.id}`}>
          父节点
        </label>
        <select
          className="mt-2 w-full rounded-md border border-white/20 bg-[#211e1a] px-3 py-2 text-sm text-[#fff7df] outline-none transition focus:border-spark-500 focus:ring-1 focus:ring-spark-500 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled || isCenter}
          id={`mind-node-parent-${node.id}`}
          onChange={(event) => setParentId(event.target.value)}
          value={isCenter ? "" : parentId}
        >
          {isCenter && <option value="">中心节点无父级</option>}
          {parentOptions.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
        </select>

        <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4">
          <button className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-white px-3 text-sm font-semibold text-[#211a15] transition hover:bg-[#fff7df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500 disabled:opacity-40" disabled={disabled || !label.trim()} type="submit">
            <Save className="h-4 w-4" aria-hidden="true" />
            保存
          </button>
          {!isCenter && !confirmingDelete && (
            <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-red-300/30 px-3 text-sm text-red-100 transition hover:border-red-300/60 hover:bg-red-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300 disabled:opacity-40" disabled={disabled} type="button" onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              删除分支
            </button>
          )}
        </div>

        {!isCenter && confirmingDelete && (
          <div className="mt-3 flex items-center gap-2 border-l-2 border-red-300/70 pl-3">
            <button className="h-9 flex-1 rounded-md bg-red-500 px-3 text-sm font-semibold text-white transition hover:bg-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300" disabled={disabled} type="button" onClick={() => onDelete(node.id)}>
              确认删除分支
            </button>
            <button className="h-9 rounded-md px-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-spark-500" disabled={disabled} type="button" onClick={() => setConfirmingDelete(false)}>
              取消删除
            </button>
          </div>
        )}
      </form>
    </aside>
  );
}
