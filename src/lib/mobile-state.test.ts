import { describe, expect, it } from "vitest";
import { validateHomeSearch } from "@/routes/index";
import { clearDraft, draftKey, loadDraft, saveDraft } from "@/lib/draft-storage";
import { confirmedSignature, loadDraw, saveDraw } from "@/lib/draw-storage";
import { shouldPersistQuery } from "@/lib/query-persistence";

function storage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe("estado mobile", () => {
  it("valida e limita os parâmetros de navegação", () => {
    expect(validateHomeSearch({ etapa: "4", jogo: "not-valid" })).toEqual({ etapa: 4 });
    expect(validateHomeSearch({ etapa: "2", carta: "novo" })).toEqual({ etapa: 2, carta: "novo" });
  });

  it("isola rascunhos por usuário e expira pelo TTL", () => {
    const store = storage();
    const key = draftKey("u1", "s1", "player");
    saveDraft(key, { name: "Bia" }, store);
    expect(loadDraft(key, Date.now(), store)).toEqual({ name: "Bia" });
    expect(loadDraft(key, Date.now() + 12 * 60 * 60 * 1000 + 1, store)).toBeNull();
    clearDraft(key, store);
    expect(loadDraft(key, Date.now(), store)).toBeNull();
  });

  it("restaura sorteio apenas com a mesma assinatura", () => {
    const store = storage();
    const draw = {
      signature: confirmedSignature([{ id: "b" }, { id: "a" }]),
      result: {} as never,
      names: [],
      layout: {},
    };
    saveDraw("event", draw, store);
    expect(loadDraw("event", "a,b", store)).toEqual(draw);
    expect(loadDraw("event", "a,c", store)).toBeNull();
  });

  it("filtra URLs assinadas do cache persistido", () => {
    expect(shouldPersistQuery(["players", "section"])).toBe(true);
    expect(shouldPersistQuery(["player-photo-signed-url", "photo"])).toBe(false);
  });
});
