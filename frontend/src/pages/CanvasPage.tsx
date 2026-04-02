import { Navigate, useParams } from "react-router-dom";
import { Canvas } from "../canvas/Canvas";
import { getSessionParticipant } from "../shared/session/participant";

export function CanvasPage() {
  const { canvasId } = useParams<{ canvasId: string }>();
  if (!canvasId) {
    return <Navigate to="/" replace />;
  }

  const participant = getSessionParticipant();
  if (!participant) {
    const pin = encodeURIComponent(canvasId);
    return <Navigate to={`/?mode=join&pin=${pin}`} replace />;
  }

  return (
    <Canvas
      canvasId={canvasId}
      userId={participant.userId}
      displayName={participant.displayName}
    />
  );
}
