package com.leetcanvas.submissions.controller;

import com.leetcanvas.submissions.model.Submission;
import com.leetcanvas.submissions.service.SubmissionService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Nullable;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/submissions")
@CrossOrigin
public class SubmissionController {

    private final SubmissionService service;

    public SubmissionController(SubmissionService service) {
        this.service = service;
    }

    /**
     * POST /api/submissions
     *
     * Client sends code + metadata, gets back a submissionId immediately.
     * Evaluation is async — the client polls GET /api/submissions/{id} for status.
     *
     * WHY ASYNC?
     * Code execution can take 1-10 seconds (or time out). Holding an HTTP
     * connection open that long is wasteful and fragile — proxies and load
     * balancers have timeout defaults. Returning an ID immediately and letting
     * the client poll is the standard pattern for long-running jobs.
     */
    @PostMapping
    public Map<String, String> submit(@RequestBody SubmitRequest req) {
        UUID id = service.submit(req.questionId(), req.userId(), req.language(), req.code());
        return Map.of("submissionId", id.toString());
    }

    /** GET /api/submissions/{id} — poll for status + result */
    @GetMapping("/{id}")
    public SubmissionStatusResponse getById(@PathVariable("id") UUID id) {
        Submission submission = service.getById(id);
        return new SubmissionStatusResponse(submission.status(), submission.result());
    }

    public record SubmitRequest(int questionId, String userId, String language, String code) {}
    public record SubmissionStatusResponse(String status, @Nullable String result) {}
}
