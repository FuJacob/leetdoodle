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

    /** GET /api/problems?page=0&size=20&difficulty=Easy&tag=Array */
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

    /**
     * GET /api/problems/slug/two-sum
     *
     * The slug is the path segment from a LeetCode URL:
     *   https://leetcode.com/problems/two-sum/  →  slug = "two-sum"
     * This is how the frontend looks up a problem after the user pastes a URL.
     */
    @GetMapping("/slug/{slug}")
    public Problem getBySlug(@PathVariable String slug) {
        return problemService.getBySlug(slug);
    }
}
