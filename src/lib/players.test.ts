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

  it("calcula os pesos corretos por posição com aritmética inteira", () => {
    const skills = { RIT: 60, CHU: 40, PAS: 70, DRI: 65, DEF: 90, FIS: 85 };
    expect(calcOverall("ATA", skills)).toBe(60);
    expect(calcOverall("MEI", skills)).toBe(67);
    expect(calcOverall("VOL", skills)).toBe(75);
    expect(calcOverall("LAT", skills)).toBe(73);
    expect(calcOverall("ZAG", skills)).toBe(82);
    expect(calcOverall("GOL", { MER: 70, MAN: 80, CHU: 60, REF: 90, VEL: 75, POS: 65 })).toBe(73);
  });

  it("arredonda meios exatos para cima e cobre as faixas mínima e máxima", () => {
    expect(calcOverall("ATA", { RIT: 70, CHU: 70, PAS: 70, DRI: 72, DEF: 70, FIS: 70 })).toBe(71);
    expect(calcOverall("ATA", { RIT: 1, CHU: 1, PAS: 1, DRI: 1, DEF: 1, FIS: 1 })).toBe(1);
    expect(calcOverall("ATA", { RIT: 99, CHU: 99, PAS: 99, DRI: 99, DEF: 99, FIS: 99 })).toBe(99);
  });

  it("normaliza as skills antes de calcular a prévia", () => {
    expect(
      calcOverall("ATA", {
        RIT: 70.5,
        CHU: 70,
        PAS: 70,
        DRI: 72,
        DEF: 70,
        FIS: 70,
        EXTRA: 99,
      }),
    ).toBe(71);
    expect(calcOverall("ATA", { RIT: Number.NaN })).toBe(1);
  });

  it("classifica tier por faixa", () => {
    expect(tierFor(64)).toBe("bronze");
    expect(tierFor(65)).toBe("prata");
    expect(tierFor(75)).toBe("ouro");
    expect(tierFor(85)).toBe("diamante");
  });
});
