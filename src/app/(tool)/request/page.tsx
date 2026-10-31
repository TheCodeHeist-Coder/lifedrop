import { RequestForm } from "./request-form";

export default function HomePage() {
  return (
    <>
      <section className="pb-6 pt-4">
        <h1 className="text-[2rem] font-bold leading-tight tracking-tight">Need blood urgently?</h1>
        <p className="mt-1 text-lg text-muted">तुरंत खून चाहिए? हम आस-पास के रक्तदाताओं को बताएँगे।</p>
        <p className="mt-3 text-muted">
          Tell us the blood group and location. We message nearby donors who can give on WhatsApp, and show you who is
          coming.
        </p>
      </section>
      <RequestForm />
    </>
  );
}
