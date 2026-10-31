import type { ReactNode } from "react";

export default function ToolLayout({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16 pt-20 sm:pt-28">{children}</main>;
}
