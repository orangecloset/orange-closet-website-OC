import { ChevronDown, ChevronUp } from "lucide-react";

export function ReorderButtons({
  label,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  className = "",
}: {
  label: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  className?: string;
}) {
  const buttonClass =
    "rounded-sm p-1 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--fg-base)] disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <div className={`flex shrink-0 items-center ${className}`}>
      <button
        type="button"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        aria-label={`Move ${label} up`}
        title="Move up"
        className={buttonClass}
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        aria-label={`Move ${label} down`}
        title="Move down"
        className={buttonClass}
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}
