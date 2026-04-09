import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BUTTON_CLASS,
  MICRO_LABEL_CLASS,
  SEGMENTED_CONTROL_CLASS,
  SEGMENTED_OPTION_ACTIVE_CLASS,
  SEGMENTED_OPTION_CLASS,
  SURFACE_SHELL_CLASS,
  TEXT_INPUT_CLASS,
} from "../shared/ui/styles";
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
      <div className={`w-full max-w-md p-5 ${SURFACE_SHELL_CLASS}`}>
        <h1 className="text-2xl font-semibold text-(--lc-text-primary)">LeetDoodle</h1>
        <p className="mt-1 text-sm text-(--lc-text-muted)">
          Pick a display name, then create or join a canvas.
        </p>

        <div className="mt-4">
          <label className={`mb-1 block ${MICRO_LABEL_CLASS}`}>
            Display Name
          </label>
          <input
            type="text"
            value={displayNameInput}
            maxLength={24}
            onChange={(event) => setDisplayNameInput(event.target.value)}
            onBlur={commitParticipantName}
            className={TEXT_INPUT_CLASS}
          />
        </div>

        <div className={`mt-4 w-full ${SEGMENTED_CONTROL_CLASS}`}>
          <button
            type="button"
            onClick={() => {
              setMode("create");
              setJoinError(null);
            }}
            className={`flex-1 ${SEGMENTED_OPTION_CLASS} ${
              mode === "create"
                ? SEGMENTED_OPTION_ACTIVE_CLASS
                : ""
            }`}
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("join");
              setJoinError(null);
            }}
            className={`flex-1 ${SEGMENTED_OPTION_CLASS} ${
              mode === "join"
                ? SEGMENTED_OPTION_ACTIVE_CLASS
                : ""
            }`}
          >
            Join
          </button>
        </div>

        <h2 className="mt-5 text-sm font-semibold text-(--lc-text-secondary)">{title}</h2>

        {mode === "join" && (
          <div className="mt-2">
            <label className={`mb-1 block ${MICRO_LABEL_CLASS}`}>
              Canvas Pin
            </label>
            <input
              type="text"
              value={joinPinInput}
              onChange={(event) => {
                setJoinPinInput(event.target.value);
                setJoinError(null);
              }}
              className={TEXT_INPUT_CLASS}
              placeholder="fcb217ea-13b6-4c3f-88fd-0f6be76f4a6b"
            />
            {joinError && <p className="mt-1 text-xs text-(--lc-danger)">{joinError}</p>}
          </div>
        )}

        <button
          type="button"
          onClick={mode === "create" ? handleCreateCanvas : handleJoinCanvas}
          className={`${BUTTON_CLASS} mt-4 w-full bg-(--lc-surface-1) px-6 py-3 font-medium text-(--lc-text-primary)`}
        >
          {mode === "create" ? "Create Canvas" : "Join Canvas"}
        </button>
      </div>
    </div>
  );
}
