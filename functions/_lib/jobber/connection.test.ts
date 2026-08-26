import { describe, expect, it } from "vitest";
import {
  computeExpiresAt,
  deleteJobberConnection,
  getJobberConnection,
  isConnectionExpiredOrNearExpiry,
  putJobberConnection,
} from "./connection";
import { createMockKv } from "./test-support";
import type { JobberConnection } from "./types";

const sampleConnection: JobberConnection = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  obtainedAt: new Date().toISOString(),
  scope: "clients:write jobs:write",
};

describe("getJobberConnection / putJobberConnection / deleteJobberConnection", () => {
  it("returns null when nothing is stored", async () => {
    const kv = createMockKv();
    expect(await getJobberConnection(kv)).toBeNull();
  });

  it("round-trips a stored connection", async () => {
    const kv = createMockKv();
    await putJobberConnection(kv, sampleConnection);
    expect(await getJobberConnection(kv)).toEqual(sampleConnection);
  });

  it("removes the connection on delete", async () => {
    const kv = createMockKv();
    await putJobberConnection(kv, sampleConnection);
    await deleteJobberConnection(kv);
    expect(await getJobberConnection(kv)).toBeNull();
  });

  it("returns null for corrupted JSON rather than throwing", async () => {
    const kv = createMockKv({ "jobber:connection": "not valid json" });
    expect(await getJobberConnection(kv)).toBeNull();
  });
});

describe("isConnectionExpiredOrNearExpiry", () => {
  it("is false for a connection comfortably far from expiring", () => {
    const connection: JobberConnection = {
      ...sampleConnection,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    };
    expect(isConnectionExpiredOrNearExpiry(connection)).toBe(false);
  });

  it("is true once inside the safety window before expiry", () => {
    const connection: JobberConnection = {
      ...sampleConnection,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    expect(isConnectionExpiredOrNearExpiry(connection)).toBe(true);
  });

  it("is true for a connection that has already expired", () => {
    const connection: JobberConnection = {
      ...sampleConnection,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    };
    expect(isConnectionExpiredOrNearExpiry(connection)).toBe(true);
  });
});

describe("computeExpiresAt", () => {
  it("computes a future ISO timestamp from expires_in seconds", () => {
    const before = Date.now();
    const result = computeExpiresAt(3600);
    const after = Date.now();

    const resultMs = new Date(result).getTime();
    expect(resultMs).toBeGreaterThanOrEqual(before + 3600_000);
    expect(resultMs).toBeLessThanOrEqual(after + 3600_000);
  });

  it("defaults to 3600 seconds when expires_in is missing", () => {
    const result = computeExpiresAt(undefined);
    const resultMs = new Date(result).getTime();
    expect(resultMs).toBeGreaterThan(Date.now() + 3500_000);
  });
});
