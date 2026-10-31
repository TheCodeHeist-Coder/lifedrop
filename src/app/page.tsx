import { Fraunces, Tiro_Devanagari_Hindi } from "next/font/google";
import Link from "next/link";
import { DistanceRings, DonorRipple, Drop, LineIcon, SectionLabel } from "@/components/landing-visuals";
import { APP_NAME, ERAKTKOSH_URL } from "@/lib/config";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

const tiro = Tiro_Devanagari_Hindi({
  variable: "--font-tiro",
  weight: "400",
  subsets: ["devanagari"],
});

const STAT_SOURCE =
  "https://medicaldialogues.in/amp/news/health/10-percent-of-districts-lack-blood-centre-health-ministry-flags-gaps-169246";

const STEPS = [
  {
    title: "Share what you know",
    body: "Pick the blood group and location, or paste the message that is already being forwarded. We fill in the rest for you to check.",
  },
  {
    title: "We find who can help",
    body: "Only compatible donors who are eligible to give today. Anyone who donated too recently is left out automatically.",
  },
  {
    title: "Donors hear on WhatsApp",
    body: "A few nearby donors get a simple message. They reply YES or NO, with nothing to install.",
  },
  {
    title: "You see who is coming",
    body: "The moment someone agrees, their name and number appear on your screen so you can call them.",
  },
];

const PROMISES = [
  {
    title: "Donors stay private",
    body: "A donor's name and number are shared only after they say yes. They can pause alerts or delete their details at any time.",
    icon: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z",
  },
  {
    title: "Medical rules, never guesses",
    body: "Blood compatibility and donation gaps are fixed rules, not AI. The blood centre still does the final health check and cross-match.",
    icon: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3ZM9 12l2 2 4-4",
  },
  {
    title: "In the words you use",
    body: "Paste a forwarded message just as it arrived, in English or Hinglish. Donors can reply the way they text, like haan or nahi.",
    icon: "M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  },
  {
    title: "Never a dead end",
    body: null,
    icon: "M4 12h15M13 6l6 6-6 6",
  },
];

const primaryLink =
  "inline-flex items-center justify-center rounded-full bg-blood px-7 py-3.5 text-lg font-semibold text-white shadow-[0_14px_30px_-14px_rgba(180,22,44,0.7)] transition-colors hover:bg-blood-deep";

const secondaryLink =
  "inline-flex items-center justify-center rounded-full border border-ink/15 bg-white/70 px-7 py-3.5 text-lg font-semibold transition-colors hover:border-ink/40";

export default function LandingPage() {
  return (
    <div className={`${fraunces.variable} ${tiro.variable} flex-1 overflow-x-clip`}>
      <header className="sticky top-0 z-20 border-b border-line/60 bg-paper/85 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Drop className="size-6" />
            {APP_NAME}
          </Link>
          <div className="flex items-center gap-5">
            <a href="#how" className="hidden font-medium text-muted hover:text-ink sm:block">
              How it works
            </a>
            <Link href="/donate" className="hidden font-medium text-muted hover:text-ink sm:block">
              Become a donor
            </Link>
            <Link
              href="/request"
              className="rounded-full bg-blood px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blood-deep"
            >
              Find a donor
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative">
          <div className="hero-glow absolute inset-0 -z-10" />
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-24 lg:pt-20">
            <div className="rise">
              <h1 className="font-display text-[2.9rem] font-medium leading-[1.06] tracking-[-0.02em] text-ink sm:text-6xl lg:text-[4.4rem]">
                No one should search for blood alone.
              </h1>
              <p className="mt-4 font-hindi text-2xl text-muted sm:text-[1.7rem]">
                खून की तलाश में कोई अकेला न हो।
              </p>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
                Tell {APP_NAME} the blood group and location. We reach nearby donors who can give, on WhatsApp, and show
                you who is coming.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/request" className={primaryLink}>
                  Find a donor now
                </Link>
                <Link href="/donate" className={secondaryLink}>
                  Become a donor
                </Link>
              </div>
              <p className="mt-4 text-sm text-muted">No app to install. No account needed.</p>
            </div>
            <div className="rise" style={{ animationDelay: "0.15s" }}>
              <DonorRipple />
            </div>
          </div>
        </section>

        <section className="reveal mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <SectionLabel>Why this exists</SectionLabel>
          <h2 className="mt-3 max-w-3xl font-display text-4xl font-medium leading-[1.12] tracking-[-0.015em] sm:text-5xl">
            In an emergency, families are left to piece it together.
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line">
            <div className="md:pr-8">
              <h3 className="text-xl font-semibold">Appeals get lost</h3>
              <p className="mt-2 leading-relaxed text-muted">
                Requests scatter across WhatsApp groups and Instagram stories, with no way to know who saw them or who
                can actually give.
              </p>
            </div>
            <div className="md:px-8">
              <h3 className="text-xl font-semibold">Portals are hard in a crisis</h3>
              <p className="mt-2 leading-relaxed text-muted">
                Official records exist, but working through a government portal is difficult when every minute feels
                like an hour.
              </p>
            </div>
            <div className="md:pl-8">
              <p className="font-display text-5xl font-medium text-blood">Nearly 10%</p>
              <p className="mt-2 leading-relaxed text-muted">
                of India&apos;s districts have no blood centre at all, according to the{" "}
                <a href={STAT_SOURCE} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                  Health Ministry, April 2026
                </a>
                .
              </p>
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-20 bg-sand">
          <div className="reveal mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="mt-3 max-w-2xl font-display text-4xl font-medium leading-[1.12] tracking-[-0.015em] sm:text-5xl">
              From a worried message to a person on the way.
            </h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className="flex size-11 items-center justify-center rounded-full bg-white font-display text-xl text-blood">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-xl font-semibold">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="reveal mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div>
            <SectionLabel>Gentle by design</SectionLabel>
            <h2 className="mt-3 font-display text-4xl font-medium leading-[1.12] tracking-[-0.015em] sm:text-5xl">
              Nearest first. Then a little further.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-muted">
              We don&apos;t message everyone at once. We ask a few donors close by and give them a moment to reply. Only
              if they can&apos;t come does the search widen, ring by ring, up to 300 km.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              That means fewer alerts for donors, and it reaches beyond your district when the nearest help is far away.
            </p>
          </div>
          <div className="rounded-3xl bg-white p-6 sm:p-8">
            <DistanceRings />
          </div>
        </section>

        <section className="bg-sand">
          <div className="reveal mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <SectionLabel>Built with care</SectionLabel>
            <h2 className="mt-3 max-w-2xl font-display text-4xl font-medium leading-[1.12] tracking-[-0.015em] sm:text-5xl">
              Careful with people, and with the facts.
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {PROMISES.map((promise) => (
                <article key={promise.title} className="rounded-3xl bg-white p-6 sm:p-7">
                  <span className="flex size-10 items-center justify-center rounded-full bg-blush text-blood">
                    <LineIcon path={promise.icon} />
                  </span>
                  <h3 className="mt-4 text-xl font-semibold">{promise.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">
                    {promise.body ?? (
                      <>
                        If no donor can come, we say so plainly and point you to blood centre stock on{" "}
                        <a href={ERAKTKOSH_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                          eRaktKosh
                        </a>
                        .
                      </>
                    )}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-wine text-white">
          <div className="reveal mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:py-28">
            <h2 className="font-display text-4xl font-medium leading-[1.12] tracking-[-0.015em] sm:text-[3.4rem]">
              Be the person who shows up.
            </h2>
            <p className="mt-3 font-hindi text-2xl text-white/80">किसी की ज़िंदगी में वह एक इंसान बनें।</p>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/80">
              We only message you when someone nearby needs your blood group and you are able to give. Reply STOP
              whenever you like.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/donate"
                className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3.5 text-lg font-semibold text-wine transition-colors hover:bg-blush"
              >
                Become a donor
              </Link>
              <Link
                href="/request"
                className="inline-flex items-center justify-center rounded-full border border-white/30 px-7 py-3.5 text-lg font-semibold transition-colors hover:border-white/70"
              >
                I need blood now
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:px-6 md:flex-row md:items-center md:justify-between">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <Drop className="size-5" />
          {APP_NAME}
          <span className="font-normal text-muted">Built at hackCBS 9.0</span>
        </p>
        <p className="max-w-xl md:text-right">
          {APP_NAME} connects people. It is not a medical service. In a medical emergency, speak to the hospital
          directly.
        </p>
      </footer>
    </div>
  );
}
