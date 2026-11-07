export type AttendanceStatus = "CONFIRMED" | "PENDING" | "DECLINED";

export type AttendanceRow = {
  id: string;
  status: AttendanceStatus;
  waitlist_position: number | null;
  responded_at: string | null;
};

export function normalizeAttendanceStatus(value: string | null | undefined): AttendanceStatus {
  switch (value?.trim().toUpperCase()) {
    case "CONFIRMED":
      return "CONFIRMED";
    case "DECLINED":
      return "DECLINED";
    case "PENDING":
    default:
      return "PENDING";
  }
}

export function isConfirmedForDraw(value: string | null | undefined): boolean {
  return normalizeAttendanceStatus(value) === "CONFIRMED";
}

export function getConfirmedAttendance<T extends AttendanceRow>(rows: T[]): T[] {
  return [...rows]
    .filter((row) => normalizeAttendanceStatus(row.status) === "CONFIRMED")
    .sort((left, right) => {
      const leftRank = left.waitlist_position ?? Number.MAX_SAFE_INTEGER;
      const rightRank = right.waitlist_position ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      const leftAt = left.responded_at ?? "1970-01-01T00:00:00.000Z";
      const rightAt = right.responded_at ?? "1970-01-01T00:00:00.000Z";
      return new Date(leftAt).getTime() - new Date(rightAt).getTime();
    });
}

export function sortWaitlist<T extends AttendanceRow>(rows: T[]): T[] {
  return getConfirmedAttendance(rows);
}
