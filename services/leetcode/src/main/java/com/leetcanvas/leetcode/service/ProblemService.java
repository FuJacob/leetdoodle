package com.leetcanvas.leetcode.service;

import com.leetcanvas.leetcode.model.Problem;
import com.leetcanvas.leetcode.model.TestCase;
import com.leetcanvas.leetcode.repository.ProblemRepository;
import com.leetcanvas.leetcode.repository.TestCaseRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Application service for read-only problem retrieval use cases.
 *
 * <p>Controllers and gRPC handlers call this service to keep query logic centralized and
 * consistent across transports.
 */
@Service
public class ProblemService {

    private final ProblemRepository problemRepository;
    private final TestCaseRepository testCaseRepository;

    public ProblemService(ProblemRepository problemRepository, TestCaseRepository testCaseRepository) {
        this.problemRepository = problemRepository;
        this.testCaseRepository = testCaseRepository;
    }

    /**
     * Returns a page of problems filtered by optional difficulty and tag.
     *
     * @param difficulty nullable difficulty filter (for example, EASY/MEDIUM/HARD)
     * @param tag nullable topic tag filter
     * @param page zero-based page index
     * @param size page size
     * @return filtered list of problems
     */
    public List<Problem> list(String difficulty, String tag, int page, int size) {
        return problemRepository.findAll(difficulty, tag, page * size, size);
    }

    /**
     * Counts problems that match the optional filters.
     *
     * @param difficulty nullable difficulty filter
     * @param tag nullable topic tag filter
     * @return total number of matching problems
     */
    public long count(String difficulty, String tag) {
        return problemRepository.countAll(difficulty, tag);
    }

    /**
     * Looks up a single problem by slug.
     *
     * @param slug unique problem slug
     * @return the matched problem
     * @throws ResponseStatusException when no problem exists for the slug
     */
    public Problem getBySlug(String slug) {
        return problemRepository.findBySlug(slug)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "Problem \"" + slug + "\" not found"
            ));
    }

    /**
     * Returns deterministic evaluation cases for a problem id.
     *
     * @param problemId internal numeric problem id
     * @return ordered test cases used by the worker during evaluation
     */
    public List<TestCase> getTestCases(int problemId) {
        return testCaseRepository.findByProblemId(problemId);
    }
}
