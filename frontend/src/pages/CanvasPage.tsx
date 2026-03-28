import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Canvas } from '../canvas/Canvas';

export function CanvasPage() {
  const { canvasId } = useParams<{ canvasId: string }>();

  // Stable userId for this browser session — survives refresh, dies on tab close
  const userId = useMemo(() => {
    const stored = sessionStorage.getItem('userId');
    if (stored) return stored;
    const id = crypto.randomUUID();
    sessionStorage.setItem('userId', id);
    return id;
  }, []);

  return <Canvas canvasId={canvasId!} userId={userId} />;
}
