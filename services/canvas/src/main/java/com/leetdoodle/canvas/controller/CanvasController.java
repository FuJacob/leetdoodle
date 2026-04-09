package com.leetdoodle.canvas.controller;

import com.leetdoodle.canvas.model.CanvasSnapshot;
import com.leetdoodle.canvas.model.CommittedCanvasOperation;
import com.leetdoodle.canvas.model.StructuralOperationRequest;
import com.leetdoodle.canvas.service.CanvasService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * HTTP debug surface for durable canvas state and structural sequencing.
 *
 * <p>The internal hot path now uses gRPC from collab -> canvas-service. These
 * endpoints remain useful for manual inspection and debugging because they are
 * easy to exercise with curl/Postman during local development.
 */
@RestController
@RequestMapping("/api/canvases")
@CrossOrigin(origins = "*")
public class CanvasController {

    private final CanvasService canvasService;

    public CanvasController(CanvasService canvasService) {
        this.canvasService = canvasService;
    }

    /**
     * Return the current durable canvas state.
     */
    @GetMapping("/{canvasId}")
    public CanvasSnapshot getSnapshot(@PathVariable String canvasId) {
        return canvasService.getSnapshot(canvasId);
    }

    /**
     * Return committed structural ops newer than the caller's last known version.
     */
    @GetMapping("/{canvasId}/ops")
    public List<CommittedCanvasOperation> getOperationsAfter(@PathVariable String canvasId,
                                                             @RequestParam long afterVersion,
                                                             @RequestParam(required = false) Integer limit) {
        return canvasService.getOperationsAfter(canvasId, afterVersion, limit);
    }

    /**
     * Commit one durable structural operation.
     */
    @PostMapping("/{canvasId}/ops")
    public CommittedCanvasOperation applyStructuralOperation(@PathVariable String canvasId,
                                                             @RequestBody StructuralOperationRequest request) {
        return canvasService.applyStructuralOperation(canvasId, request);
    }
}
