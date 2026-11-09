import { describe, expect, it } from "vitest";
import { createBoardFeed } from "./board-feed";

describe("createBoardFeed", () => {
  it("une relecture revenue après une diffusion ne l'écrase pas", async () => {
    const shown: string[] = [];
    let resolve!: (v: string) => void;
    const feed = createBoardFeed<string>((b) => shown.push(b), () => new Promise((r) => (resolve = r)));
    const pending = feed.refresh();
    feed.push("après l'appel");
    resolve("avant l'appel");
    await pending;
    expect(shown).toEqual(["après l'appel"]);
  });
  it("sans diffusion pendant la relecture, la relecture s'applique", async () => {
    const shown: string[] = [];
    const feed = createBoardFeed<string>((b) => shown.push(b), async () => "relu");
    await feed.refresh();
    expect(shown).toEqual(["relu"]);
  });
});
