import Script from 'next/script';
import Link from 'next/link';

const PRODUCT = {
  id: '8123456789',
  title: 'Merino Wool Crew Sweater',
  price: '$148.00',
  store: 'demo-store.myshopify.com',
};

export const metadata = {
  title: `${PRODUCT.title} — Demo Store`,
};

export default function DemoStorefront() {
  return (
    <main className="min-h-screen bg-white">
      <div className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold tracking-wide text-zinc-900">DEMO STORE</span>
          <Link href="/dashboard" className="text-sm text-zinc-600 hover:text-zinc-900">
            Back to dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-12 md:grid-cols-2">
        <div className="aspect-square rounded-2xl bg-gradient-to-br from-zinc-200 to-zinc-100" />
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900">{PRODUCT.title}</h1>
          <p className="mt-2 text-xl text-zinc-700">{PRODUCT.price}</p>
          <p className="mt-4 text-sm text-zinc-600">
            A midweight crew neck knit in 100% extrafine merino. Naturally temperature regulating,
            machine washable on the wool cycle.
          </p>
          <button className="mt-6 w-full rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white">
            Add to cart
          </button>
          <p className="mt-6 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">
            Not sure about the fit? Use the <strong>Ask Past Buyers</strong> button in the bottom
            right — it is the real ReviewWhisper widget talking to the live API.
          </p>
        </div>
      </div>

      <Script
        src="/widget.js"
        data-product-id={PRODUCT.id}
        data-store-domain={PRODUCT.store}
        strategy="afterInteractive"
      />
    </main>
  );
}
