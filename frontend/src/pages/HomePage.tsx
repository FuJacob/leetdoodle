import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ensureSessionParticipant,
  isCanvasPin,
  saveSessionParticipant,
  type SessionParticipant,
} from "../shared/session/participant";

type LobbyMode = "create" | "join";

export function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode: LobbyMode = searchParams.get("mode") === "join" ? "join" : "create";
  const initialPin = searchParams.get("pin") ?? "";
  const [mode, setMode] = useState<LobbyMode>(initialMode);
  const [participant, setParticipant] = useState<SessionParticipant>(() =>
    ensureSessionParticipant(),
  );
  const [displayNameInput, setDisplayNameInput] = useState(participant.displayName);
  const [joinPinInput, setJoinPinInput] = useState(initialPin);
  const [joinError, setJoinError] = useState<string | null>(null);

  const title = useMemo(
    () => (mode === "create" ? "Create Canvas" : "Join Canvas"),
    [mode],
  );

  const commitParticipantName = useCallback(() => {
    const saved = saveSessionParticipant({
      userId: participant.userId,
      displayName: displayNameInput,
    });
    setParticipant(saved);
    setDisplayNameInput(saved.displayName);
    return saved;
  }, [participant.userId, displayNameInput]);

  const handleCreateCanvas = useCallback(() => {
    commitParticipantName();
    navigate(`/canvas/${crypto.randomUUID()}`);
  }, [commitParticipantName, navigate]);

  const handleJoinCanvas = useCallback(() => {
    const pin = joinPinInput.trim();
    if (!isCanvasPin(pin)) {
      setJoinError("Canvas pin must be a valid UUID.");
      return;
    }
    setJoinError(null);
    commitParticipantName();
    navigate(`/canvas/${pin}`);
  }, [joinPinInput, commitParticipantName, navigate]);

  return (
    <div className="flex h-full items-center justify-center bg-(--lc-canvas-bg) px-4">
      <div className="w-full max-w-md border border-(--lc-border-default) bg-(--lc-surface-1) p-5">
        <h1 className="text-2xl font-semibold text-(--lc-text-primary)">LeetDoodle</h1>
        <p className="mt-1 text-sm text-(--lc-text-muted)">
          Pick a display name, then create or join a canvas.
        </p>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold text-(--lc-text-secondary)">
            Display Name
          </label>
          <input
            type="text"
            value={displayNameInput}
            maxLength={24}
            onChange={(event) => setDisplayNameInput(event.target.value)}
            onBlur={commitParticipantName}
            className="w-full border border-(--lc-border-default) bg-(--lc-surface-2) px-3 py-2 text-sm text-(--lc-text-primary) outline-none transition focus:border-(--lc-border-focus)"
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("create");
              setJoinError(null);
            }}
            className={`border px-3 py-2 text-sm transition ${
              mode === "create"
                ? "border-(--lc-border-focus) bg-(--lc-surface-3) text-(--lc-accent)"
                : "border-(--lc-border-default) text-(--lc-text-secondary) hover:border-(--lc-border-focus) hover:text-(--lc-accent)"
            }`}
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setMode("join")}
            className={`border px-3 py-2 text-sm transition ${
              mode === "join"
                ? "border-(--lc-border-focus) bg-(--lc-surface-3) text-(--lc-accent)"
                : "border-(--lc-border-default) text-(--lc-text-secondary) hover:border-(--lc-border-focus) hover:text-(--lc-accent)"
            }`}
          >
            Join
          </button>
        </div>

        <h2 className="mt-5 text-sm font-semibold text-(--lc-text-secondary)">{title}</h2>

        {mode === "join" && (
          <div className="mt-2">
            <label className="mb-1 block text-xs font-semibold text-(--lc-text-secondary)">
              Canvas Pin
            </label>
            <input
              type="text"
              value={joinPinInput}
              onChange={(event) => {
                setJoinPinInput(event.target.value);
                setJoinError(null);
              }}
              className="w-full border border-(--lc-border-default) bg-(--lc-surface-2) px-3 py-2 text-sm text-(--lc-text-primary) outline-none transition focus:border-(--lc-border-focus)"
              placeholder="fcb217ea-13b6-4c3f-88fd-0f6be76f4a6b"
            />
            {joinError && <p className="mt-1 text-xs text-(--lc-danger)">{joinError}</p>}
          </div>
        )}

        <button
          type="button"
          onClick={mode === "create" ? handleCreateCanvas : handleJoinCanvas}
          className="mt-4 w-full border border-(--lc-border-default) bg-(--lc-surface-1) px-6 py-3 text-sm text-(--lc-text-secondary) transition hover:border-(--lc-border-focus) hover:text-(--lc-accent)"
        >
          {mode === "create" ? "Create Canvas" : "Join Canvas"}
        </button>
      </div>
    </div>
  );
}
