import type { CollabUser } from "./hooks/useCanvasCollab";

interface CanvasPresenceBarProps {
  users: CollabUser[];
  localUserId: string;
}

export function CanvasPresenceBar({ users, localUserId }: CanvasPresenceBarProps) {
  return (
    <div
      className="w2k-window"
      style={{
        minWidth: 110,
        background: "var(--w2k-btn-face)",
      }}
    >
      <div className="w2k-titlebar">
        <span style={{ fontSize: 10 }}>👥</span>
        <span>Users</span>
      </div>
      <div style={{ padding: "4px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
        {users.length === 0 && (
          <span style={{ fontSize: 10, color: "var(--w2k-gray-text)", fontFamily: '"MS Sans Serif", Tahoma, Arial, sans-serif' }}>
            (no users)
          </span>
        )}
        {users.map((user) => (
          <div
            key={user.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontFamily: '"MS Sans Serif", Tahoma, Arial, sans-serif',
              fontSize: 11,
              background: user.id === localUserId ? "var(--w2k-selected)" : "transparent",
              color: user.id === localUserId ? "var(--w2k-white)" : "var(--w2k-black)",
              padding: "1px 3px",
            }}
          >
            <div
              title={user.id === localUserId ? "You" : user.id}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: user.color,
                border: "1px solid var(--w2k-btn-dkshadow)",
                flexShrink: 0,
              }}
            />
            <span>{user.id === localUserId ? "You" : user.id.slice(0, 5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
