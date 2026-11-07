import { describe, expect, it } from "vitest";
import { calcOverall, clampWeakFoot, defaultSkills, tierFor } from "./players";

describe("player rules", () => {
  it("mantém a nota entre 0 e 5", () => {
    expect(clampWeakFoot(-1)).toBe(0);
    expect(clampWeakFoot(0)).toBe(0);
    expect(clampWeakFoot(3)).toBe(3);
    expect(clampWeakFoot(5)).toBe(5);
    expect(clampWeakFoot(6)).toBe(5);
  });

  it("calcula overall por posição e limita faixas", () => {
    const gkSkills = {
      MER: 85,
      MAN: 82,
      CHU: 70,
      REF: 88,
      VEL: 76,
      POS: 80,
    };
    const fieldSkills = defaultSkills("MEI");
    fieldSkills["RIT"] = 90;
    fieldSkills["PAS"] = 85;
    fieldSkills["DRI"] = 80;
    fieldSkills["DEF"] = 70;
    fieldSkills["FIS"] = 75;
    fieldSkills["CHU"] = 78;

    expect(calcOverall("GOL", gkSkills)).toBe(80);
    expect(calcOverall("MEI", fieldSkills)).toBe(81);
    expect(calcOverall("ATA", { RIT: 200, CHU: 200, PAS: 200, DRI: 200, DEF: 200, FIS: 200 })).toBe(
      99,
    );
    expect(calcOverall("ATA", { RIT: 0, CHU: 0, PAS: 0, DRI: 0, DEF: 0, FIS: 0 })).toBe(1);
  });

  it("classifica tier por faixa", () => {
    expect(tierFor(64)).toBe("bronze");
    expect(tierFor(65)).toBe("prata");
    expect(tierFor(75)).toBe("ouro");
    expect(tierFor(85)).toBe("diamante");
  });
});
