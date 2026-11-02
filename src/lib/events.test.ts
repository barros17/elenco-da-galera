import { describe, expect, it } from "vitest";
import { getConfirmedAttendance, isConfirmedForDraw, sortWaitlist } from "./events";

describe("event attendance rules", () => {
  it("only confirmed entries are eligible for draw", () => {
    expect(isConfirmedForDraw("CONFIRMED")).toBe(true);
    expect(isConfirmedForDraw("confirmed")).toBe(true);
    expect(isConfirmedForDraw("PENDING")).toBe(false);
    expect(isConfirmedForDraw("DECLINED")).toBe(false);
  });

  it("returns the confirmed pool in the same ranked order used by the draw", () => {
    const rows = [
      { id: "x", waitlist_position: 3, status: "PENDING" as const, responded_at: "2026-01-01T06:00:00Z" },
      { id: "a", waitlist_position: 1, status: "CONFIRMED" as const, responded_at: "2026-01-01T08:00:00Z" },
      { id: "b", waitlist_position: 2, status: "CONFIRMED" as const, responded_at: "2026-01-01T09:00:00Z" },
      { id: "c", waitlist_position: 4, status: "DECLINED" as const, responded_at: "2026-01-01T07:00:00Z" },
    ];

    expect(getConfirmedAttendance(rows)).toEqual([
      { id: "a", waitlist_position: 1, status: "CONFIRMED", responded_at: "2026-01-01T08:00:00Z" },
      { id: "b", waitlist_position: 2, status: "CONFIRMED", responded_at: "2026-01-01T09:00:00Z" },
    ]);
  });

  it("orders waitlist by confirmation time and keeps confirmed first", () => {
    const rows = [
      {
        id: "b",
        waitlist_position: 2,
        status: "CONFIRMED" as const,
        responded_at: "2026-01-01T09:00:00Z",
      },
      {
        id: "a",
        waitlist_position: 1,
        status: "CONFIRMED" as const,
        responded_at: "2026-01-01T08:00:00Z",
      },
      {
        id: "c",
        waitlist_position: 3,
        status: "PENDING" as const,
        responded_at: "2026-01-01T06:00:00Z",
      },
      {
        id: "d",
        waitlist_position: 4,
        status: "DECLINED" as const,
        responded_at: "2026-01-01T07:00:00Z",
      },
    ];

    expect(sortWaitlist(rows)).toEqual([
      { id: "a", waitlist_position: 1, status: "CONFIRMED", responded_at: "2026-01-01T08:00:00Z" },
      { id: "b", waitlist_position: 2, status: "CONFIRMED", responded_at: "2026-01-01T09:00:00Z" },
    ]);
  });
});
