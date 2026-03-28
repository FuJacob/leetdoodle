package com.leetcanvas.leetcode.service;

import com.leetcanvas.leetcode.model.Problem;
import com.leetcanvas.leetcode.repository.ProblemRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ProblemService {

    private final ProblemRepository problemRepository;

    public ProblemService(ProblemRepository problemRepository) {
        this.problemRepository = problemRepository;
    }

    public List<Problem> list(String difficulty, String tag, int page, int size) {
        return problemRepository.findAll(difficulty, tag, page * size, size);
    }

    public long count(String difficulty, String tag) {
        return problemRepository.countAll(difficulty, tag);
    }

    public Problem getBySlug(String slug) {
        return problemRepository.findBySlug(slug)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "Problem \"" + slug + "\" not found"
            ));
    }
}
