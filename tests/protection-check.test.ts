import { expect, it } from "vitest";

// Deliberately failing test: checks that main protection blocks a red pull request.
it("fails on purpose", () => {
  expect(1 + 1).toBe(3);
});
