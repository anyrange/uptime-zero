import type { ReactNode } from "react";

export function AppPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-1 flex-col gap-4">
      <div className="flex flex-1 flex-col gap-4">
        <h2 className="sr-only">{title}</h2>
        {children}
      </div>
    </section>
  );
}

export function AppPageHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {children}
    </div>
  );
}

export function AppPageHeaderContent({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}

export function AppPageLabel({ children }: { children: ReactNode }) {
  return <p className="text-lg font-medium text-foreground">{children}</p>;
}

export function AppPageSubtitle({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function AppPageActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}
