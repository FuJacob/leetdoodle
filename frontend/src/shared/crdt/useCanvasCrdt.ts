import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { CanvasOutboundEvent } from "../events";
import type { CanvasNode } from "../nodes";
import { CRDTDocument } from "./document";
import type { CrdtOp, TextEdit } from "./types";

interface Params {
  userId: string;
  nodes: CanvasNode[];
  setNodes: Dispatch<SetStateAction<CanvasNode[]>>;
  sendRef: RefObject<((event: CanvasOutboundEvent) => void) | null>;
}

/**
 * Encapsulates collaborative text-document synchronization for note and code nodes.
 *
 * The hook lazily creates per-node CRDT documents, converts local text edits
 * into outbound ops, applies remote ops and sync responses, and keeps rendered
 * node text in sync with the current CRDT state.
 *
 * Why keep a nodesRef internally?
 * React state updates rerender components, but async callbacks (WebSocket,
 * CodeMirror listeners) can fire later with old closures. A ref gives those
 * callbacks access to the latest node snapshot without forcing callback churn.
 */
export function useCanvasCrdt({ userId, nodes, setNodes, sendRef }: Params) {
  const nodesRef = useRef<CanvasNode[]>(nodes);
  const docsRef = useRef<Map<string, CRDTDocument>>(new Map());

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const findTextNode = useCallback((nodeId: string) => {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (!node) return null;
    if (node.type === "code" || node.type === "note") return node;
    return null;
  }, []);

  const setNodeText = useCallback(
    (nodeId: string, text: string) => {
      setNodes((prev) =>
        prev.map((node) => {
          if (node.id !== nodeId) return node;
          if (node.type === "code")
            return { ...node, data: { ...node.data, content: text } };
          if (node.type === "note")
            return { ...node, data: { ...node.data, content: text } };
          return node;
        }),
      );
    },
    [setNodes],
  );

  const getOrCreateDoc = useCallback(
    (nodeId: string) => {
      let doc = docsRef.current.get(nodeId);
      if (doc) return doc;

      const textNode = findTextNode(nodeId);
      if (!textNode) return null;

      doc = new CRDTDocument(userId, textNode.data.content);
      docsRef.current.set(nodeId, doc);

      // Ask peers for missed ops when this local replica first touches a document.
      sendRef.current?.({
        type: "sync_request",
        docId: nodeId,
        stateVector: doc.getStateVector(),
      });
      return doc;
    },
    [findTextNode, sendRef, userId],
  );

  const applyRemoteOps = useCallback(
    (docId: string, ops: CrdtOp[]) => {
      const doc = getOrCreateDoc(docId);
      if (!doc) return;

      let changed = false;
      for (const op of ops) {
        changed = doc.applyRemote(op) || changed;
      }

      if (changed) {
        setNodeText(docId, doc.getText());
      }
    },
    [getOrCreateDoc, setNodeText],
  );

  const onTextEdits = useCallback(
    (nodeId: string, edits: TextEdit[]) => {
      if (edits.length === 0) return;

      const doc = getOrCreateDoc(nodeId);
      if (!doc) return;

      const ops = doc.applyLocalEdits(edits);
      setNodeText(nodeId, doc.getText());

      for (const op of ops) {
        sendRef.current?.({ type: "crdt_op", docId: nodeId, op });
      }
    },
    [getOrCreateDoc, sendRef, setNodeText],
  );

  const onCrdtOp = useCallback(
    (docId: string, op: CrdtOp) => {
      applyRemoteOps(docId, [op]);
    },
    [applyRemoteOps],
  );

  const onSyncResponse = useCallback(
    (docId: string, ops: CrdtOp[]) => {
      applyRemoteOps(docId, ops);
    },
    [applyRemoteOps],
  );

  const onNodeDelete = useCallback((nodeId: string) => {
    docsRef.current.delete(nodeId);
  }, []);

  return {
    onTextEdits,
    onCrdtOp,
    onSyncResponse,
    onNodeDelete,
  };
}
