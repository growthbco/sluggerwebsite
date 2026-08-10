"use client";

export function PrintButton({ label = "🖨️ Print this sheet" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-sm px-5 py-2.5"
    >
      {label}
    </button>
  );
}
