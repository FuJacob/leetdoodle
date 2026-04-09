import type { CollabUser } from "./presence/types";
import { MICRO_LABEL_CLASS, PILL_CLASS } from "../shared/ui/styles";

interface CanvasPresenceBarProps {
  users: CollabUser[];
  localUserId: string;
}

export function CanvasPresenceBar({ users, localUserId }: CanvasPresenceBarProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={MICRO_LABEL_CLASS}>Presence</span>
      <div className="flex items-center -space-x-1.5">
        {users.map((user) => (
          <div
            key={user.id}
            title={user.id === localUserId ? `You (${user.displayName})` : user.displayName}
            className={`h-5 w-5 rounded-full border border-(--lc-surface-1) ${user.id === localUserId ? "ring-1 ring-(--lc-border-strong)" : ""}`}
            style={{ backgroundColor: user.color }}
          />
        ))}
      </div>
      <span className={`${PILL_CLASS} px-1.5`}>{users.length}</span>
    </div>
  );
}
