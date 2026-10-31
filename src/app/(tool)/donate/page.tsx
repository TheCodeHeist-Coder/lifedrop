import { DonorForm } from "./donor-form";

export default function DonatePage() {
  return (
    <>
      <section className="pb-6 pt-4">
        <h1 className="text-[2rem] font-bold leading-tight tracking-tight">Be the person who shows up</h1>
        <p className="mt-1 text-lg text-muted">रक्तदाता बनें</p>
        <p className="mt-3 text-muted">
          We only message you when someone nearby needs your blood group and you are able to give. Reply YES or NO on
          WhatsApp, with nothing to install.
        </p>
      </section>
      <DonorForm />
    </>
  );
}
