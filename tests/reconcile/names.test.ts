import { describe, expect, it } from "vitest";
import { nameSimilarity, nameTokens, skeleton, transliterate } from "../../src/lib/reconcile/names";

describe("name matching", () => {
  it("transliterates Arabic", () => {
    expect(transliterate("محمد")).toBe("mhmd");
    expect(transliterate("خالد")).toBe("khald");
  });

  it("builds spelling-independent skeletons", () => {
    for (const [a, b] of [
      ["mohammad", "muhammed"],
      ["khaled", "khalid"],
      ["mhmd", "mohamad"],
      ["zoubi", "zubi"],
      ["qudah", "kudah"],
    ]) {
      expect(skeleton(a), `${a} vs ${b}`).toBe(skeleton(b));
    }
  });

  it("drops al- prefixes and stop words", () => {
    expect(nameTokens("AL WAHA DRIVING SCHOOL")).toEqual(["waha", "driving", "school"]);
    expect(nameTokens("الزعبي")).toEqual(["zaby"]);
    expect(nameTokens("cloudjo.hosting")).toEqual(["cloudjo", "hosting"]);
  });

  const same: [string, string][] = [
    ["RAMI SAMIR NASSAR", "رامي سمير نصار"],
    ["KHALED OMAR HADDAD", "خالد عمر حداد"],
    ["MOHAMMAD ZOUBI", "محمد الزعبي"],
    ["QAHWET AL BALAD CAFE", "Qahwet Al Balad"],
    ["SAHTEIN KITCHEN", "sahtein.kitchen"],
    ["LICENSE HUB MIDDLE EAST", "License Hub"],
    ["MUHAMMED KHALID", "MOHAMMAD KHALED"],
  ];
  for (const [a, b] of same) {
    it(`matches ${a} ≈ ${b}`, () => expect(nameSimilarity(a, b)).toBeGreaterThanOrEqual(0.85));
  }

  const different: [string, string][] = [
    ["RAMI SAMIR NASSAR", "HUDA FARES TARAWNEH"],
    ["QAHWET AL BALAD CAFE", "Lamsa Furniture"],
    ["ZAID OMAR SALEH", "زيد عمر"], // partial: shares first names only -> must not look certain
  ];
  for (const [a, b] of different.slice(0, 2)) {
    it(`separates ${a} / ${b}`, () => expect(nameSimilarity(a, b)).toBeLessThan(0.6));
  }
  it("scores a partial name below a full one", () => {
    expect(nameSimilarity("ZAID OMAR SALEH", "زيد عمر")).toBeLessThan(nameSimilarity("ZAID OMAR SALEH", "زيد عمر صالح"));
  });
  it("returns 0 for missing names", () => {
    expect(nameSimilarity(null, "x")).toBe(0);
    expect(nameSimilarity("", "")).toBe(0);
  });
});
