import { describe, expect, it } from "vitest";

import { selectCronMonitorBatch } from "@/api/lib/monitoring-scheduler";

describe("monitoring scheduler", () => {
  it("selects a stable minute batch from due monitors", () => {
    const monitors = ["a", "b", "c", "d", "e"];

    expect(selectCronMonitorBatch(monitors, 120_000, 2)).toEqual(["e", "a"]);
  });

  it("returns all due monitors when the batch is large enough", () => {
    const monitors = ["a", "b"];

    expect(selectCronMonitorBatch(monitors, 120_000, 30)).toEqual(monitors);
  });
});
