// 这个文件提供画布内本地节点搜索，并把命中结果交给视口进行定位。
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { MindNode } from "../../types/idea";

interface MindMapSearchProps {
  nodes: MindNode[];
  disabled: boolean;
  onFocusNode: (node: MindNode) => void;
}

export function MindMapSearch({ nodes, disabled, onFocusNode }: MindMapSearchProps): JSX.Element {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    if (!normalized) return [];
    return nodes.filter((node) => `${node.label} ${node.category} ${node.source ?? ""}`.toLocaleLowerCase("zh-CN").includes(normalized)).slice(0, 6);
  }, [nodes, query]);

  return (
    <div className="mindmap-search">
      <Search className="h-4 w-4 text-white/36" aria-hidden="true" />
      <label className="sr-only" htmlFor="mindmap-search-input">搜索导图节点</label>
      <input id="mindmap-search-input" aria-label="搜索导图节点" disabled={disabled} onChange={(event) => setQuery(event.target.value)} placeholder="搜索节点、分类或来源" type="search" value={query} />
      {query && <button aria-label="清除搜索" disabled={disabled} type="button" onClick={() => setQuery("")}><X className="h-3.5 w-3.5" aria-hidden="true" /></button>}
      {results.length > 0 && (
        <div className="mindmap-search-results" role="listbox" aria-label="节点搜索结果">
          {results.map((node) => <button disabled={disabled} key={node.id} role="option" type="button" onClick={() => { onFocusNode(node); setQuery(""); }}><span>{node.label}</span><small>{node.category}</small></button>)}
        </div>
      )}
    </div>
  );
}
