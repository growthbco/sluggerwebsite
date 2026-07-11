"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="max-w-2xl mx-auto px-4 py-24 text-center">
      <p className="display text-brand text-sm tracking-widest uppercase">Error</p>
      <h1 className="display text-4xl sm:text-5xl text-foreground mt-3">
        Something went wrong
      </h1>
      <p className="text-muted mt-4">
        We hit a snag loading this page. It&apos;s usually temporary, so give it
        another try. If it keeps happening, email{" "}
        <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">
          apparel@sluggerathletics.com
        </a>{" "}
        and we&apos;ll take care of you.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-sm px-6 py-3 transition-colors"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="border border-brand/70 text-foreground hover:bg-brand/10 display text-sm px-6 py-3 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </section>
  );
}
