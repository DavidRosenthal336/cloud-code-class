import Logo from './Logo.jsx';

export default function Header({ onSignOut, showSignOut }) {
  return (
    <header className="bg-navy text-white">
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-gold/40">
        <div>
          <Logo className="h-10 w-auto text-slate-300" />
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold-soft mt-2">
            Deal Underwriting Assistant
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-300">
          <span className="hidden sm:inline">
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
          {showSignOut && (
            <button
              onClick={onSignOut}
              className="text-gold-soft hover:text-white transition-colors uppercase tracking-wide"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
