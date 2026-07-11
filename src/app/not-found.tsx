import Link from "next/link";

export default function NotFound() {
  return (
    <section className="max-w-2xl mx-auto px-4 py-24 text-center">
      <p className="display text-brand text-sm tracking-widest uppercase">404</p>
      <h1 className="display text-4xl sm:text-5xl text-foreground mt-3">
        That page struck out
      </h1>
      <p className="text-muted mt-4">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
        Head back to the shop or start a custom design.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/shop"
          className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-sm px-6 py-3 transition-colors"
        >
          Shop Gear
        </Link>
        <Link
          href="/design"
          className="border border-brand/70 text-foreground hover:bg-brand/10 display text-sm px-6 py-3 transition-colors"
        >
          Start a Design
        </Link>
      </div>
    </section>
  );
}
