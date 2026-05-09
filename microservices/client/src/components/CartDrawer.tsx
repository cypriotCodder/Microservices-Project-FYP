
import { Icon } from './Icon';

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  category: string;
  swatch?: string;
}

interface CartItem extends Product {
  qty: number;
}

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  inc: (p: Product) => void;
  dec: (p: Product) => void;
  remove: (p: Product) => void;
  onCheckout: () => void;
}

const Placeholder = ({ swatch = "#E8DCC8", label, large = false }: { swatch?: string, label: string, large?: boolean }) => (
  <div className="relative w-full h-full overflow-hidden rounded-xl swatch-stripe" style={{ backgroundColor: swatch }}>
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="px-2.5 py-1 rounded-full bg-paper/80 backdrop-blur-sm text-[10px] tracking-wide text-mute font-mono">
        {label}
      </div>
    </div>
    {large && <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-paper/60" />}
  </div>
);

export function CartDrawer({ open, onClose, items, inc, dec, remove, onCheckout }: CartDrawerProps) {
  const subtotal = items.reduce((s, l) => s + l.price * l.qty, 0);

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
      <div onClick={onClose} className={`absolute inset-0 bg-ink/30 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} />
      <aside className={`absolute right-0 top-0 bottom-0 w-full sm:w-[420px] bg-paper border-l border-line shadow-pop transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-16 px-5 flex items-center justify-between border-b border-line">
          <div className="flex items-center gap-2">
            <Icon name="bag" size={18} />
            <span className="text-sm font-medium">your cart</span>
            <span className="text-xs text-mute">· {items.reduce((s, l) => s + l.qty, 0)} items</span>
          </div>
          <button onClick={onClose} className="h-9 w-9 grid place-items-center rounded-full hover:bg-line/60 transition">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 196px)' }}>
          {items.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-14 h-14 rounded-full bg-line/60 mx-auto grid place-items-center text-mute"><Icon name="bag" size={20} /></div>
              <p className="mt-4 text-sm text-mute">nothing here yet.</p>
              <button onClick={onClose} className="mt-4 text-sm text-coral hover:text-coralHi">browse the catalog →</button>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map(l => (
                <li key={l.id} className="flex gap-3">
                  <div className="w-16 h-20 rounded-lg overflow-hidden flex-shrink-0">
                    <Placeholder swatch={l.swatch} label="img" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm leading-snug truncate">{l.name}</div>
                      <button onClick={() => remove(l)} className="text-mute hover:text-ink"><Icon name="x" size={14} /></button>
                    </div>
                    <div className="text-xs text-mute mt-0.5">{l.category}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="inline-flex items-center h-8 rounded-full border border-line">
                        <button onClick={() => dec(l)} className="w-8 h-8 grid place-items-center text-mute hover:text-ink"><Icon name="minus" size={12} /></button>
                        <span className="text-xs w-6 text-center tabular-nums">{l.qty}</span>
                        <button onClick={() => inc(l)} className="w-8 h-8 grid place-items-center text-mute hover:text-ink"><Icon name="plus" size={12} /></button>
                      </div>
                      <div className="text-sm tabular-nums">${(l.price * l.qty).toFixed(2)}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="absolute left-0 right-0 bottom-0 border-t border-line bg-paper p-5">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-mute">subtotal</span>
            <span className="tabular-nums">${subtotal.toFixed(2)}</span>
          </div>
          <div className="text-[11px] text-mute mb-4">shipping and taxes calculated at checkout.</div>
          <button
            disabled={items.length === 0}
            onClick={onCheckout}
            className={`w-full h-11 rounded-full text-sm font-medium flex items-center justify-center gap-2 transition
              ${items.length === 0 ? 'bg-line/60 text-mute cursor-not-allowed' : 'bg-coral text-paper hover:bg-coralHi'}`}>
            checkout <Icon name="arrow" size={14} />
          </button>
        </div>
      </aside>
    </div>
  );
}
