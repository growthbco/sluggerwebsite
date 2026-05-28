import Link from "next/link";

const tabs = [
  { href: "/shop", label: "All", key: "" },
  { href: "/shop/uniforms", label: "Uniforms", key: "uniforms" },
  { href: "/shop/hats", label: "Hats", key: "hats" },
  { href: "/shop/chains", label: "Chains", key: "chains" },
  { href: "/shop/accessories", label: "Accessories", key: "accessories" },
];

export function CategoryTabs({ active = "" }: { active?: string }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`clip-slant display text-sm px-5 py-2.5 transition-colors ${
              isActive
                ? "bg-brand text-on-brand"
                : "bg-steel border border-line text-foreground/80 hover:text-foreground hover:border-brand/50"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
