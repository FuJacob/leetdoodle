package com.leetcanvas.leetcode.controller;

import com.leetcanvas.leetcode.model.Problem;
import com.leetcanvas.leetcode.service.ProblemService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/problems")
@CrossOrigin   // allow the Vite dev server (localhost:5173) to call this
public class ProblemController {

    private final ProblemService problemService;

    public ProblemController(ProblemService problemService) {
        this.problemService = problemService;
    }

    /*
     * GET /api/problems?page=0&size=20&difficulty=Easy&tag=Array
     *
     * Returns a JSON object with:
     *   { "content": [...], "page": 0, "size": 20,
     *     "totalElements": 3879, "totalPages": 194 }
     *
     * We build this map ourselves instead of relying on Spring Data's Page
     * abstraction — no ORM magic, just a plain Map that Jackson serialises.
     */
    @GetMapping
    public Map<String, Object> list(
        @RequestParam(required = false) String difficulty,
        @RequestParam(required = false) String tag,
        @RequestParam(defaultValue = "0")  int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        List<Problem> content = problemService.list(difficulty, tag, page, size);
        long totalElements = problemService.count(difficulty, tag);
        int totalPages = (int) Math.ceil((double) totalElements / size);

        return Map.of(
            "content",       content,
            "page",          page,
            "size",          size,
            "totalElements", totalElements,
            "totalPages",    totalPages
        );
    }

    /*
     * GET /api/problems/1   — fetch "Two Sum"
     * GET /api/problems/42  — fetch "Trapping Rain Water"
     *
     * Uses the user-facing frontend_id (the problem number), not the
     * internal question_id, because that's what users actually refer to.
     */
    @GetMapping("/{frontendId}")
    public Problem get(@PathVariable int frontendId) {
        return problemService.getByFrontendId(frontendId);
    }
}
