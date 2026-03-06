import Link from 'next/link';

export default function MarketingHomePage() {
  return (
    <main className="bg-slate-950 text-white">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-3 text-sm uppercase tracking-widest text-indigo-300">Mi Patrimonio Pro</p>
        <h1 className="max-w-3xl text-5xl font-bold leading-tight">Understand and grow your net worth.</h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-300">
          Visualiza tus activos, pasivos y progreso financiero por portfolio en una plataforma SaaS moderna.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/signup" className="rounded-lg bg-indigo-500 px-5 py-3 font-semibold">
            Start Free
          </Link>
          <Link href="/pricing" className="rounded-lg border border-slate-700 px-5 py-3 font-semibold">
            View Pricing
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-20 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">Multi-portfolio tracking</div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">Powerful analytics dashboard</div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">SaaS-ready billing & onboarding</div>
      </section>
    </main>
  );
}
