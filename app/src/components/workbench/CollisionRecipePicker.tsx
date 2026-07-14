// 这个文件提供按需出现的碰撞配方浮层，由思维导图负责打开和提交选择。
import { X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { cn } from "../../lib/cn";
import { COLLISION_RECIPES, type CollisionRecipeId } from "../../types/idea";

interface CollisionRecipePickerProps {
  disabled: boolean;
  onCancel: () => void;
  onSelect: (recipeId: CollisionRecipeId) => void;
}

// 展示六种紧凑思维动作，并提供 Escape 与方向键操作。
export function CollisionRecipePicker({ disabled, onCancel, onSelect }: CollisionRecipePickerProps): JSX.Element {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    optionRefs.current[0]?.focus();
  }, []);

  // 在浮层内处理关闭和配方间的键盘导航。
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) return;

    event.preventDefault();
    const currentIndex = optionRefs.current.findIndex((option) => option === document.activeElement);
    const lastIndex = COLLISION_RECIPES.length - 1;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? lastIndex
        : event.key === "ArrowDown" || event.key === "ArrowRight"
          ? (Math.max(0, currentIndex) + 1) % COLLISION_RECIPES.length
          : currentIndex <= 0 ? lastIndex : currentIndex - 1;
    optionRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      aria-disabled={disabled}
      aria-labelledby="collision-recipe-picker-title"
      aria-modal="false"
      className="w-[min(46rem,calc(100vw-3rem))] overflow-hidden rounded-md border border-white/20 bg-[#171411]/95 text-[#fff7df] shadow-2xl backdrop-blur-xl"
      role="dialog"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold" id="collision-recipe-picker-title">选择碰撞方式</h2>
        <button
          aria-label="取消选择碰撞方式"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-spark-500 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled}
          title="取消"
          type="button"
          onClick={onCancel}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <ul aria-label="碰撞配方" className="grid grid-cols-2" role="list">
        {COLLISION_RECIPES.map((recipe, index) => (
          <li className="border-t border-white/10 odd:border-r" key={recipe.id}>
            <button
              ref={(element) => { optionRefs.current[index] = element; }}
              aria-current={index === 0 ? "true" : undefined}
              className={cn(
                "flex min-h-16 w-full flex-col items-start justify-center px-4 py-3 text-left transition hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-spark-500 disabled:cursor-not-allowed disabled:opacity-40",
                index === 0 && "bg-spark-500/15",
              )}
              disabled={disabled}
              type="button"
              onClick={() => onSelect(recipe.id)}
            >
              <span className="text-sm font-semibold text-[#fff7df]">{recipe.label}</span>
              <span className="mt-1 text-xs leading-5 text-white/60">{recipe.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
