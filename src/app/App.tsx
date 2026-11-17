export function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-lime-300">
        DAA course project
      </p>
      <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
        Smart Racing Championship
      </h1>
      <p className="max-w-xl text-lg leading-relaxed text-slate-300">
        Project foundation is ready. The five screens, race engine, and algorithm
        modules can now be built in their assigned folders.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {['Main Menu', 'Track Explorer / Route Planner', 'Racing Screen', 'Algorithm Lab', 'Championship Dashboard'].map((screen) => (
          <li key={screen} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            {screen}
            <span className="mt-1 block text-sm text-slate-400">Planned</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
