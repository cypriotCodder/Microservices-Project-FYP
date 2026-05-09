
import { Icon } from './Icon';

export function Footer() {
  const cols = [
    { title: "shop", items: ["all products", "new this week", "bundles", "gift cards"] },
    { title: "help", items: ["shipping", "returns", "warranty", "contact us"] },
    { title: "company", items: ["our story", "careers", "press", "wholesale"] },
  ];

  return (
    <footer className="border-t border-line">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
        <div className="grid md:grid-cols-[1.2fr_1fr_1fr_1fr] gap-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-ink text-paper grid place-items-center"><Icon name="logo" size={16} /></span>
              <span className="text-[15px] font-medium tracking-tight">microshop</span>
            </div>
            <p className="mt-4 text-sm text-mute leading-relaxed max-w-xs">
              tools and parts for the patient builder. shipped from a small workshop in lisbon.
            </p>
            <div className="mt-5 flex items-center gap-2">
              {["instagram", "twitter", "youtube", "github"].map(n => (
                <a key={n} href="#" aria-label={n} className="w-9 h-9 grid place-items-center rounded-full border border-line text-mute hover:text-ink hover:border-ink/30 transition">
                  <Icon name={n} size={14} />
                </a>
              ))}
            </div>
          </div>
          {cols.map(c => (
            <div key={c.title}>
              <div className="text-[11px] uppercase tracking-[0.16em] text-mute mb-4">{c.title}</div>
              <ul className="space-y-3">
                {c.items.map(i => (
                  <li key={i}><a href="#" className="text-sm text-ink/85 hover:text-coral transition">{i}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-line flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-mute">
          <div>© 2026 microshop. a tiny independent storefront.</div>
          <div className="flex items-center gap-5">
            <a href="#" className="hover:text-ink">privacy</a>
            <a href="#" className="hover:text-ink">terms</a>
            <a href="#" className="hover:text-ink">accessibility</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
