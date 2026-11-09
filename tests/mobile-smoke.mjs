import { chromium } from "playwright";

const viewports = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 640, height: 320 },
  { width: 740, height: 360 },
  { width: 844, height: 390 },
  { width: 915, height: 412 },
];
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto(process.env.MOBILE_BASE_URL ?? "http://127.0.0.1:4173", {
      waitUntil: "networkidle",
    });
    const result = await page.evaluate(() => {
      const right = window.innerWidth;
      const overflowing = [...document.querySelectorAll("body *")].filter((element) => {
        const style = getComputedStyle(element);
        const insideScrollable =
          element.parentElement && getComputedStyle(element.parentElement).overflowX === "auto";
        return (
          !insideScrollable &&
          style.position !== "fixed" &&
          element.getBoundingClientRect().right > right + 1
        );
      });
      const attendanceRows = [...document.querySelectorAll('[data-testid="attendance-row"]')];
      const attendanceOverflow = attendanceRows.filter((row) => {
        const container = row.parentElement?.getBoundingClientRect();
        const bounds = row.getBoundingClientRect();
        const player = row
          .querySelector('[data-testid="attendance-player"]')
          ?.getBoundingClientRect();
        const status = row
          .querySelector('[data-testid="attendance-status"]')
          ?.getBoundingClientRect();
        return (
          !container ||
          !player ||
          bounds.width > container.width + 1 ||
          player.width <= 0 ||
          (status && status.width <= 0) ||
          bounds.right > container.right + 1
        );
      });
      return {
        scrollWidth: document.documentElement.scrollWidth,
        overflowing: overflowing.length,
        attendanceRows: attendanceRows.length,
        attendanceOverflow: attendanceOverflow.length,
      };
    });
    if (
      result.scrollWidth > viewport.width ||
      result.overflowing > 0 ||
      result.attendanceOverflow > 0
    ) {
      throw new Error(`${viewport.width}px: overflow detectado (${JSON.stringify(result)})`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
