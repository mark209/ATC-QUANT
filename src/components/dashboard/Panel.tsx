import type { ReactNode } from "react";

export function Panel({
  title,
  action,
  children,
  className = ""
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel-frame rounded-lg p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-bold uppercase tracking-normal text-slate-100">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
