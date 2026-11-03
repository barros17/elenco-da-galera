import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampWeakFoot } from "./players";

describe("perna ruim", () => {
  it("mantém a nota entre 0 e 5", () => {
    assert.equal(clampWeakFoot(-1), 0);
    assert.equal(clampWeakFoot(0), 0);
    assert.equal(clampWeakFoot(3), 3);
    assert.equal(clampWeakFoot(5), 5);
    assert.equal(clampWeakFoot(6), 5);
  });
});