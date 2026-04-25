export default function Header() {
  return (
    <header className="bg-navy text-white">
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-baseline justify-between border-b border-gold/40">
        <div>
          <h1 className="font-serif text-2xl tracking-wide">Rose Valley Capital</h1>
          <p className="text-xs uppercase tracking-[0.2em] text-gold-soft mt-1">
            Deal Underwriting Assistant
          </p>
        </div>
        <div className="text-xs text-slate-300 hidden sm:block">
          {new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>
    </header>
  );
}
