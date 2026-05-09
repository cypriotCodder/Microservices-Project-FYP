import React, { useState } from 'react';
import { Icon } from './Icon';

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "error" | "done">("idle");
  
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setState("error"); return; }
    setState("done");
  };

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 my-16">
      <div className="relative overflow-hidden rounded-3xl bg-coralBg p-8 md:p-12">
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-coral/15" />
        <div className="absolute -right-8 bottom-0 w-40 h-40 rounded-full bg-coral/10" />

        <div className="relative grid md:grid-cols-[1fr_auto] gap-8 md:items-center">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-coralHi">
              <Icon name="spark" size={12} /> field notes
            </div>
            <h2 className="mt-3 text-3xl md:text-4xl tracking-tight font-medium">
              build alongside our community.
            </h2>
            <p className="mt-2 text-sm text-mute md:max-w-md">
              one short letter every other friday — new arrivals, teardown notes, and the occasional discount code.
            </p>
          </div>

          <form onSubmit={submit} className="w-full md:w-auto">
            {state === "done" ? (
              <div className="animate-fadeIn inline-flex items-center gap-3 h-12 px-5 rounded-full bg-paper border border-line">
                <span className="w-7 h-7 rounded-full bg-sageBg text-sage grid place-items-center"><Icon name="check" size={14} /></span>
                <span className="text-sm">you're on the list, {email.split('@')[0]}.</span>
              </div>
            ) : (
              <div className={`flex items-center bg-paper rounded-full p-1.5 border ${state === 'error' ? 'border-coral' : 'border-line'} w-full md:w-[420px] shadow-card`}>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
                  placeholder="you@example.com"
                  className="flex-1 px-4 h-9 bg-transparent outline-none text-sm placeholder:text-mute"
                />
                <button className="h-9 px-5 rounded-full bg-coral text-paper text-sm font-medium hover:bg-coralHi transition flex items-center gap-2">
                  subscribe <Icon name="arrow" size={14} />
                </button>
              </div>
            )}
            {state === "error" && <p className="mt-2 ml-2 text-xs text-coralHi">that doesn't look like a valid email.</p>}
          </form>
        </div>
      </div>
    </section>
  );
}
