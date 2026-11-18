import { describe, expect, it } from "vitest";
import { describeUserAgent } from "./user-agent";

describe("describeUserAgent", () => {
  it("reconnaît les navigateurs et systèmes courants", () => {
    expect(
      describeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"),
    ).toEqual({ browser: "Safari", os: "iPhone" });
    expect(
      describeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"),
    ).toEqual({ browser: "Chrome", os: "Windows" });
    expect(
      describeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 Edg/124.0"),
    ).toEqual({ browser: "Edge", os: "Windows" });
    expect(describeUserAgent("Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36")).toEqual({
      browser: "Samsung Internet",
      os: "Android",
    });
    expect(describeUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:126.0) Gecko/20100101 Firefox/126.0")).toEqual({ browser: "Firefox", os: "Mac" });
  });

  it("sans User-Agent ou inconnu : rien d'inventé", () => {
    expect(describeUserAgent(null)).toEqual({ browser: null, os: null });
    expect(describeUserAgent("curl/8.0")).toEqual({ browser: null, os: null });
  });
});
