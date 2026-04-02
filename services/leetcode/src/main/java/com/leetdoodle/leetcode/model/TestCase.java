package com.leetdoodle.leetcode.model;

import org.immutables.value.Value;
import javax.annotation.Nullable;

/**
 * An immutable test case for a problem.
 *
 * WHY IMMUTABLE?
 * Test cases are loaded from JSONL and inserted into the database once.
 * After that, they're read-only (for now). Immutables gives us:
 * - Thread-safe value objects
 * - Automatic equals/hashCode/toString
 * - Type safety — the compiler catches mutations
 */
@Value.Immutable
public interface TestCase {
  @Nullable
  Integer id();

  Integer problemId(); // FK to problems

  String input();

  String output();
}
