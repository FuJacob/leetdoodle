import type { CollabUser } from "./hooks/useCanvasCollab";

interface CanvasPresenceBarProps {
  users: CollabUser[];
  localUserId: string;
}

export function CanvasPresenceBar({ users, localUserId }: CanvasPresenceBarProps) {
  return (
    <div className="flex items-center gap-5 border border-(--lc-border-default) bg-(--lc-surface-1) p-2">
      {users.map((user) => (
        <div key={user.id} className="flex items-center gap-2">
          {/*
            user.id remains the primary collab identity; displayName is UI-only.
            If older payloads omit displayName, fallback happens in useCanvasCollab.
          */}
          <div
            title={user.id === localUserId ? `You (${user.displayName})` : user.displayName}
            className={`h-3 w-3 rounded-full ${user.id === localUserId ? "ring-1 ring-(--lc-border-strong)" : ""}`}
            style={{ backgroundColor: user.color }}
          />
          <p className="max-w-28 truncate text-(--lc-text-primary)">{user.displayName}</p>
        </div>
      ))}
    </div>
  );
}
