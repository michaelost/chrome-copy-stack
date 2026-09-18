import { describe, expect, it } from "vitest";
import manifest from "../manifest.json";

describe("manifest content script registration", () => {
  it("injects content.ts into ordinary web pages at document_start, all frames", () => {
    expect(manifest.content_scripts).toEqual([
      {
        matches: ["<all_urls>"],
        js: ["src/content.ts"],
        run_at: "document_start",
        all_frames: true,
      },
    ]);
  });

  it("keeps clipboardRead/clipboardWrite/storage permissions the capture flow depends on", () => {
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(["storage", "clipboardWrite", "clipboardRead"]),
    );
  });
});
