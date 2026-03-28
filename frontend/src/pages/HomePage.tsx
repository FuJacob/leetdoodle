import { useNavigate } from 'react-router-dom';

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-2xl font-semibold text-zinc-100">LeetCanvas</h1>
        <button
          onClick={() => navigate(`/canvas/${crypto.randomUUID()}`)}
          className="border border-zinc-700 px-6 py-3 text-sm text-zinc-200"
        >
          New Canvas
        </button>
      </div>
    </div>
  );
}
