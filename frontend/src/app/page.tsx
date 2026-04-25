export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-lbp-blue-50 via-white to-slate-50 p-8">
      <div className="w-full max-w-2xl bg-card border border-border rounded-lg shadow-sm p-8 md:p-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
            LBP
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Les Bons Plombiers
            </h1>
            <p className="text-sm text-muted-foreground">Espace professionnel</p>
          </div>
        </div>

        {/* Status */}
        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-foreground">
            Frontend opérationnel
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-sm font-medium text-foreground">Next.js 16</span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-sm font-medium text-foreground">Tailwind v4</span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-sm font-medium text-foreground">React 19</span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-sm font-medium text-foreground">TypeScript 5</span>
            </div>
          </div>
        </div>

        {/* Palette */}
        <div className="space-y-3 mb-8">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Palette LBP
          </h3>
          <div className="flex gap-2">
            <div className="flex-1 h-12 rounded bg-lbp-blue-50 border border-border" title="50" />
            <div className="flex-1 h-12 rounded bg-lbp-blue-100 border border-border" title="100" />
            <div className="flex-1 h-12 rounded bg-lbp-blue-500" title="500" />
            <div className="flex-1 h-12 rounded bg-lbp-blue-600" title="600 — primary" />
            <div className="flex-1 h-12 rounded bg-lbp-blue-700" title="700" />
            <div className="flex-1 h-12 rounded bg-lbp-blue-900" title="900" />
          </div>
        </div>

        {/* Boutons test */}
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-lbp-blue-700 transition-colors">
            Bouton primaire
          </button>
          <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md font-medium hover:bg-muted transition-colors">
            Bouton secondaire
          </button>
          <button className="px-4 py-2 border border-border bg-card text-foreground rounded-md font-medium hover:bg-muted transition-colors">
            Bouton outline
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-border text-xs text-muted-foreground">
          PixFeed EI · v0.1.0 · Build développement
        </div>
      </div>
    </main>
  );
}
