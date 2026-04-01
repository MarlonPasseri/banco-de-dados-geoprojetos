import { type ReactNode } from "react";
import { Sparkles, type LucideIcon } from "lucide-react";

type EmptyStateProps = {
  title: string;
  text?: string;
  Icon?: LucideIcon;
  compact?: boolean;
  children?: ReactNode;
};

export function EmptyState({ title, text, Icon = Sparkles, compact = false, children }: EmptyStateProps) {
  return (
    <div className={`empty-state ${compact ? "py-5" : "py-8"}`}>
      <div className="mx-auto mb-2 inline-flex rounded-xl bg-zinc-100 p-2 text-zinc-700">
        <Icon size={16} />
      </div>
      <div className="text-sm font-semibold text-zinc-800">{title}</div>
      {text ? <div className="mx-auto mt-1 max-w-[56ch] text-xs text-zinc-500">{text}</div> : null}
      {children ? <div className="mx-auto mt-4 flex max-w-[56ch] flex-wrap items-center justify-center gap-2">{children}</div> : null}
    </div>
  );
}

export function TableSkeletonRows({
  cols,
  rows = 5,
  withActions = false,
}: {
  cols: number;
  rows?: number;
  withActions?: boolean;
}) {
  const totalCols = Math.max(1, cols) + (withActions ? 1 : 0);
  const rowList = Array.from({ length: rows }, (_, idx) => idx);
  const colList = Array.from({ length: totalCols }, (_, idx) => idx);

  return (
    <>
      {rowList.map((r) => (
        <tr key={`sk-row-${r}`} className="border-b">
          {colList.map((c) => (
            <td key={`sk-col-${r}-${c}`} className="px-3 py-3">
              <div className="skeleton h-3.5 w-full min-w-[72px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
