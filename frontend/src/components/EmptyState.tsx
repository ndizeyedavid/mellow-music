import type { ReactNode } from "react";
import { MdLibraryMusic } from "react-icons/md";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

/** Shared empty-state block used across pages. */
export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="text-subtle/60">{icon ?? <MdLibraryMusic size={40} />}</div>
      <h3 className="mt-4 text-[16px]/[22px] font-semibold text-fg">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-[14px]/[20px] text-subtle">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
