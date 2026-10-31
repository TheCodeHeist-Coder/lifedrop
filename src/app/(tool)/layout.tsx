import type { ReactNode } from "react";
import { SiteHeader } from "@/components/ui";

export default function ToolLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16">{children}</main>
    </>
  );
}
