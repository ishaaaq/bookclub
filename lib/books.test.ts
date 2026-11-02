import { describe, expect, it } from "vitest";
import {
  coverUrl,
  likePattern,
  mergeResults,
  normaliseDoc,
  normaliseQuery,
  normaliseSearch,
  parseCandidate,
} from "./books";

describe("normaliseQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(normaliseQuery("  stay   with\nme ")).toBe("stay with me");
  });

  it("returns null for empty or one-character queries", () => {
    expect(normaliseQuery(null)).toBeNull();
    expect(normaliseQuery("   ")).toBeNull();
    expect(normaliseQuery("a")).toBeNull();
  });

  it("caps very long queries", () => {
    expect(normaliseQuery("x".repeat(500))).toHaveLength(100);
  });
});

describe("coverUrl", () => {
  it("builds a medium cover URL by default", () => {
    expect(coverUrl(8231856)).toBe("https://covers.openlibrary.org/b/id/8231856-M.jpg");
  });

  it("is undefined without a usable cover id", () => {
    expect(coverUrl(undefined)).toBeUndefined();
    expect(coverUrl(-1)).toBeUndefined();
    expect(coverUrl(0)).toBeUndefined();
  });
});

describe("normaliseDoc", () => {
  it("maps an Open Library doc", () => {
    expect(
      normaliseDoc({ key: "/works/OL17360763W", title: "Americanah", author_name: ["Chimamanda Ngozi Adichie"], cover_i: 7389576 }),
    ).toEqual({
      openLibraryKey: "/works/OL17360763W",
      title: "Americanah",
      author: "Chimamanda Ngozi Adichie",
      coverUrl: "https://covers.openlibrary.org/b/id/7389576-M.jpg",
    });
  });

  it("joins at most two authors", () => {
    expect(normaliseDoc({ title: "Good Omens", author_name: ["Terry Pratchett", "Neil Gaiman", "Someone Else"] })?.author).toBe(
      "Terry Pratchett, Neil Gaiman",
    );
  });

  it("drops untitled docs and malformed keys", () => {
    expect(normaliseDoc({ key: "/works/OL1W" })).toBeNull();
    expect(normaliseDoc({ title: "  " })).toBeNull();
    expect(normaliseDoc({ key: "/books/OL1M", title: "Edition" })?.openLibraryKey).toBeUndefined();
  });
});

describe("normaliseSearch", () => {
  it("removes duplicate works and ignores junk", () => {
    const results = normaliseSearch({
      docs: [
        { key: "/works/OL1W", title: "Half of a Yellow Sun" },
        { key: "/works/OL1W", title: "Half of a Yellow Sun" },
        { title: "" },
        { title: "Stay With Me", author_name: ["Ayọ̀bámi Adébáyọ̀"] },
        { title: "stay with me", author_name: ["Ayọ̀bámi Adébáyọ̀"] },
      ],
    });
    expect(results.map((r) => r.title)).toEqual(["Half of a Yellow Sun", "Stay With Me"]);
  });

  it("handles a bad response", () => {
    expect(normaliseSearch(null)).toEqual([]);
    expect(normaliseSearch({ docs: "nope" })).toEqual([]);
  });
});

describe("mergeResults", () => {
  it("puts club books first and drops remote duplicates", () => {
    const club = [{ id: "b1", openLibraryKey: "/works/OL1W", title: "Americanah" }];
    const remote = [
      { openLibraryKey: "/works/OL1W", title: "Americanah" },
      { openLibraryKey: "/works/OL2W", title: "Purple Hibiscus" },
    ];
    expect(mergeResults(club, remote).map((b) => b.id ?? b.openLibraryKey)).toEqual(["b1", "/works/OL2W"]);
  });

  it("matches club books without a key by title and author", () => {
    const merged = mergeResults(
      [{ id: "b1", title: "Americanah", author: "Chimamanda Ngozi Adichie" }],
      [
        { openLibraryKey: "/works/OL1W", title: "Americanah", author: "Chimamanda Ngozi Adichie" },
        { openLibraryKey: "/works/OL2W", title: "Americanah", author: "SparkNotes" },
      ],
    );
    expect(merged.map((b) => b.id ?? b.openLibraryKey)).toEqual(["b1", "/works/OL2W"]);
  });

  it("respects the limit", () => {
    const remote = Array.from({ length: 20 }, (_, i) => ({ title: `Book ${i}` }));
    expect(mergeResults([], remote, 10)).toHaveLength(10);
  });
});

describe("likePattern", () => {
  it("escapes wildcards", () => {
    expect(likePattern("100%_true\\")).toBe("%100\\%\\_true\\\\%");
  });
});

describe("parseCandidate", () => {
  it("keeps a well-formed Open Library pick", () => {
    const book = {
      openLibraryKey: "/works/OL17360763W",
      title: " Americanah ",
      author: "Chimamanda Ngozi Adichie",
      coverUrl: "https://covers.openlibrary.org/b/id/7389576-M.jpg",
    };
    expect(parseCandidate(book)).toEqual({ ...book, id: undefined, title: "Americanah" });
  });

  it("drops fields it can't vouch for", () => {
    expect(
      parseCandidate({ id: "not-a-uuid", openLibraryKey: "/authors/OL1A", title: "Book", coverUrl: "https://evil.example/x.jpg" }),
    ).toEqual({ id: undefined, openLibraryKey: undefined, title: "Book", author: undefined, coverUrl: undefined });
  });

  it("rejects anything without a title", () => {
    expect(parseCandidate(null)).toBeNull();
    expect(parseCandidate("Americanah")).toBeNull();
    expect(parseCandidate({ title: "   " })).toBeNull();
  });
});
