import { useNavigate } from 'react-router-dom';

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full items-center justify-center bg-(--lc-canvas-bg)">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-2xl font-semibold text-(--lc-text-primary)">LeetCanvas</h1>
        <button
          onClick={() => navigate(`/canvas/${crypto.randomUUID()}`)}
          className="border border-(--lc-border-default) bg-(--lc-surface-1) px-6 py-3 text-sm text-(--lc-text-secondary) transition hover:border-(--lc-border-focus) hover:text-(--lc-accent)"
        >
          New Canvas
        </button>
      </div>
    </div>
  );
}
