CREATE TABLE test_cases (
  id SERIAL PRIMARY KEY,
  problem_id INT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  input TEXT NOT NULL,
  output TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_test_cases_problem_id ON test_cases(problem_id);
