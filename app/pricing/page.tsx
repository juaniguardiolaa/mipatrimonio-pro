import Link from 'next/link';

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-4xl font-bold">Pricing</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border p-6">
          <h2 className="text-xl font-semibold">Free</h2>
          <p>1 portfolio, hasta 20 assets.</p>
        </div>
        <div className="rounded-xl border p-6">
          <h2 className="text-xl font-semibold">Pro</h2>
          <p>Portfolios ilimitados, analytics completos.</p>
        </div>
      </div>
      <Link href="/signup" className="mt-8 inline-block rounded-lg bg-indigo-500 px-5 py-3 font-semibold text-white">
        Start now
      </Link>
    </main>
  );
}
