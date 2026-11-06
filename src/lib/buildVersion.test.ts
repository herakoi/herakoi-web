import { describe, expect, it } from "vitest";
import { parseGitDescribe } from "./buildVersion";

describe("parseGitDescribe", () => {
  it("uses the bare tag on a tagged commit", () => {
    expect(parseGitDescribe("v1.2.0-0-g1a2b3c4")).toEqual({ version: "1.2.0", commit: "1a2b3c4" });
  });

  it("counts the commits since the last tag", () => {
    expect(parseGitDescribe("v1.1.1-27-gbfbadd7\n")).toEqual({
      version: "1.1.1+27",
      commit: "bfbadd7",
    });
  });

  it("keeps a pre-release suffix of the tag", () => {
    expect(parseGitDescribe("v2.0.0-beta.1-3-gabcdef0")).toEqual({
      version: "2.0.0-beta.1+3",
      commit: "abcdef0",
    });
  });

  it("returns nothing for output it does not recognise", () => {
    expect(parseGitDescribe("bfbadd7")).toBeUndefined();
  });
});
