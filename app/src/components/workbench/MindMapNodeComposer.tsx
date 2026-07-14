// 这个文件处理用户手动新增灵感节点的轻量表单。
import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { MindNodeCategory } from "../../types/idea";

const CATEGORIES: Exclude<MindNodeCategory, "中心">[] = ["人群", "场景", "情绪", "物件", "结构", "限制", "远联想"];

interface MindMapNodeComposerProps {
  open: boolean;
  disabled: boolean;
  onClose: () => void;
  onSubmit: (label: string, category: Exclude<MindNodeCategory, "中心">) => void;
}

export function MindMapNodeComposer({ open, disabled, onClose, onSubmit }: MindMapNodeComposerProps): JSX.Element | null {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<Exclude<MindNodeCategory, "中心">>("物件");
  if (!open) return null;
  const submit = (): void => {
    if (!label.trim() || disabled) return;
    onSubmit(label, category);
    setLabel("");
  };
  return (
    <form className="mindmap-composer" aria-label="新增灵感节点" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div className="mindmap-composer-heading"><span>手动加入一颗星</span><button aria-label="关闭新增节点" disabled={disabled} type="button" onClick={onClose}><X className="h-4 w-4" aria-hidden="true" /></button></div>
      <label htmlFor="manual-node-label">节点内容</label>
      <input autoFocus id="manual-node-label" disabled={disabled} maxLength={42} onChange={(event) => setLabel(event.target.value)} placeholder="写下一条观察或联想" value={label} />
      <label htmlFor="manual-node-category">节点分类</label>
      <select id="manual-node-category" disabled={disabled} onChange={(event) => setCategory(event.target.value as Exclude<MindNodeCategory, "中心">)} value={category}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
      <button className="mindmap-composer-submit" disabled={!label.trim() || disabled} type="submit"><Plus className="h-4 w-4" aria-hidden="true" />加入画布</button>
    </form>
  );
}
