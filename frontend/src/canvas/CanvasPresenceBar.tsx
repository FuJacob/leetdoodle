import type { CollabUser } from "./hooks/useCanvasCollab";

interface CanvasPresenceBarProps {
  users: CollabUser[];
  localUserId: string;
}

export function CanvasPresenceBar({ users, localUserId }: CanvasPresenceBarProps) {
  return (
    <div className="flex items-center gap-5 border border-zinc-700 bg-zinc-900 p-2">
      {users.map((user) => (
        <div key={user.id} className="flex items-center gap-2">
          <div
            title={user.id === localUserId ? "You" : user.id}
            className={`h-3 w-3 rounded-full ${user.id === localUserId ? "ring-1 ring-zinc-300" : ""}`}
            style={{ backgroundColor: user.color }}
          />
          <p className="text-white">{user.id.slice(0, 5)}</p>
        </div>
      ))}
    </div>
  );
}
