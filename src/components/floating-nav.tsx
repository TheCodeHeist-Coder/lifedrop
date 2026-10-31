import Link from "next/link";
import { Drop } from "@/components/landing-visuals";
import { APP_NAME } from "@/lib/config";

const linkClass =
  "whitespace-nowrap rounded-full px-3 py-2 font-semibold text-ink transition-colors hover:bg-ink/5 max-[359px]:px-2 sm:px-5 lg:px-6";

function Divider({ className = "" }: { className?: string }) {
  return <span className={`h-5 w-px shrink-0 bg-ink/15 ${className}`} aria-hidden="true" />;
}

export function FloatingNav() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-3 z-30 flex justify-center px-4 sm:top-5">
      <nav
        aria-label="Main"
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-ink/10 bg-white/55 p-1.5 text-[0.95rem] shadow-[0_14px_40px_-18px_rgba(74,20,32,0.4),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl backdrop-saturate-150 max-[359px]:text-sm sm:gap-1.5 sm:p-2 sm:text-[1.0625rem] lg:p-2.5 lg:text-lg"
      >
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-full px-2.5 py-2 font-bold tracking-tight max-[359px]:px-1.5 sm:px-4 lg:px-5"
        >
          <Drop className="size-5 sm:size-6" />
          {APP_NAME}
        </Link>
        <Divider />
        <Link href="/#how" className={`${linkClass} hidden sm:block`}>
          How it works
        </Link>
        <Divider className="hidden sm:block" />
        <Link href="/donate" className={linkClass}>
          <span className="sm:hidden">Donate</span>
          <span className="hidden sm:inline">Become a donor</span>
        </Link>
        <Divider className="hidden sm:block" />
        <Link
          href="/request"
          className="whitespace-nowrap rounded-full bg-blood px-4 py-2 font-semibold text-white transition-colors hover:bg-blood-deep max-[359px]:px-3 sm:ml-1 sm:px-6 sm:py-2.5 lg:px-7"
        >
          Find a donor
        </Link>
      </nav>
    </header>
  );
}
