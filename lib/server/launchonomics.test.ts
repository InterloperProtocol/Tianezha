import { describe, expect, it } from "vitest";

import { evaluateLaunchonomicsWindow } from "@/lib/server/launchonomics";
import {
  DEFAULT_ACCESS_TOKEN_SYMBOL,
  DEFAULT_PUMP_TOKEN_MINT,
} from "@/lib/token-defaults";

const launchAt = "2026-03-19T12:00:00.000Z";
const wallet = "3vV4fGQm3xwY4yM8f2uyT8zYqb6P5SzY6h5o4PSJVpQ4";
const tokenMint = DEFAULT_PUMP_TOKEN_MINT;
const tokenSymbol = DEFAULT_ACCESS_TOKEN_SYMBOL;

describe("launchonomics tier evaluation", () => {
  it("grants a 5-year tier for a first trade in the first 10 minutes", () => {
    const result = evaluateLaunchonomicsWindow({
      wallet,
      launchAt,
      tokenMint,
      tokenSymbol,
      transfers: [
        {
          amountRaw: "1000000",
          direction: "in",
          mint: tokenMint,
          signature: "sig-a",
          timestamp: Date.parse("2026-03-19T12:05:00.000Z") / 1000,
        },
        {
          amountRaw: "1000000",
          direction: "out",
          mint: tokenMint,
          signature: "sig-b",
          timestamp: Date.parse("2026-03-19T18:00:00.000Z") / 1000,
        },
      ],
      currentBalance: 0,
    });

    expect(result.tier).toBe("five_year");
    expect(result.heldThrough24Hours).toBe(false);
    expect(result.badge).toBe("launch-trader");
  });

  it("grants a yearly tier for a first trade in the first hour", () => {
    const result = evaluateLaunchonomicsWindow({
      wallet,
      launchAt,
      tokenMint,
      tokenSymbol,
      transfers: [
        {
          amountRaw: "1000000",
          direction: "in",
          mint: tokenMint,
          signature: "sig-c",
          timestamp: Date.parse("2026-03-19T12:42:00.000Z") / 1000,
        },
        {
          amountRaw: "1000000",
          direction: "out",
          mint: tokenMint,
          signature: "sig-c-2",
          timestamp: Date.parse("2026-03-20T02:00:00.000Z") / 1000,
        },
      ],
      currentBalance: 0,
    });

    expect(result.tier).toBe("yearly");
    expect(result.heldThrough24Hours).toBe(false);
  });

  it("grants a monthly tier for a first trade in the first 12 hours", () => {
    const result = evaluateLaunchonomicsWindow({
      wallet,
      launchAt,
      tokenMint,
      tokenSymbol,
      transfers: [
        {
          amountRaw: "1000000",
          direction: "in",
          mint: tokenMint,
          signature: "sig-d",
          timestamp: Date.parse("2026-03-19T16:15:00.000Z") / 1000,
        },
        {
          amountRaw: "1000000",
          direction: "out",
          mint: tokenMint,
          signature: "sig-d-2",
          timestamp: Date.parse("2026-03-20T03:30:00.000Z") / 1000,
        },
      ],
      currentBalance: 0,
    });

    expect(result.tier).toBe("monthly");
    expect(result.badge).toBe("launch-trader");
  });

  it("upgrades to lifetime when the wallet still holds through the 24-hour mark", () => {
    const result = evaluateLaunchonomicsWindow({
      wallet,
      launchAt,
      tokenMint,
      tokenSymbol,
      transfers: [
        {
          amountRaw: "1000000",
          direction: "in",
          mint: tokenMint,
          signature: "sig-e",
          timestamp: Date.parse("2026-03-20T07:00:00.000Z") / 1000,
        },
      ],
      currentBalance: 1,
    });

    expect(result.tier).toBe("lifetime");
    expect(result.heldThrough24Hours).toBe(true);
    expect(result.badge).toBe("verified");
    expect(result.subscriptionEndsAt).toBeUndefined();
  });
});
