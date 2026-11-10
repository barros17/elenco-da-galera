import { describe, expect, it } from "vitest";
import { validateSearch, validateHomeSearch } from "@/routes/index";
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

describe("estado mobile — novos search params (aba/visao/dialogo/jogo/id)", () => {
  it("retorna aba padrão 'jogos' para parâmetros ausentes", () => {
    expect(validateSearch({})).toEqual({ aba: "jogos" });
  });

  it("aceita valores válidos de aba", () => {
    expect(validateSearch({ aba: "elenco" })).toMatchObject({ aba: "elenco" });
    expect(validateSearch({ aba: "secao" })).toMatchObject({ aba: "secao" });
    expect(validateSearch({ aba: "jogos" })).toMatchObject({ aba: "jogos" });
  });

  it("ignora aba inválida e cai em 'jogos'", () => {
    expect(validateSearch({ aba: "invalido" })).toMatchObject({ aba: "jogos" });
  });

  it("aceita visao válida", () => {
    expect(validateSearch({ aba: "jogos", visao: "times" })).toMatchObject({
      aba: "jogos",
      visao: "times",
    });
    expect(validateSearch({ aba: "jogos", visao: "presenca" })).toMatchObject({
      visao: "presenca",
    });
  });

  it("ignora visao inválida", () => {
    const result = validateSearch({ aba: "jogos", visao: "invalido" });
    expect(result.visao).toBeUndefined();
  });

  it("aceita dialogo válido", () => {
    expect(validateSearch({ dialogo: "novo-jogo" })).toMatchObject({ dialogo: "novo-jogo" });
    expect(validateSearch({ dialogo: "editar-jogador" })).toMatchObject({
      dialogo: "editar-jogador",
    });
  });

  it("ignora dialogo inválido", () => {
    const result = validateSearch({ dialogo: "xpto" });
    expect(result.dialogo).toBeUndefined();
  });

  it("aceita jogo UUID válido", () => {
    expect(validateSearch({ jogo: "550e8400-e29b-41d4-a716-446655440000" })).toMatchObject({
      jogo: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("rejeita jogo UUID inválido", () => {
    const result = validateSearch({ jogo: "not-a-uuid" });
    expect(result.jogo).toBeUndefined();
  });

  it("preserva convite sanitizado na URL", () => {
    expect(validateSearch({ invite: "a1b2c3d4" })).toMatchObject({ invite: "A1B2C3D4" });
    expect(validateSearch({ invite: "abc" })).not.toHaveProperty("invite");
  });
});

describe("estado mobile — compatibilidade com links antigos (etapa/carta)", () => {
  it("traduz etapa=1 para aba=elenco", () => {
    expect(validateSearch({ etapa: 1 })).toMatchObject({ aba: "elenco" });
  });

  it("traduz etapa=2 para aba=elenco", () => {
    expect(validateSearch({ etapa: 2 })).toMatchObject({ aba: "elenco" });
  });

  it("traduz etapa=1 + carta=novo para aba=elenco com dialogo=novo-jogador", () => {
    expect(validateSearch({ etapa: 1, carta: "novo" })).toMatchObject({
      aba: "elenco",
      dialogo: "novo-jogador",
    });
  });

  it("traduz etapa=1 + carta=UUID para aba=elenco com dialogo=editar-jogador e id", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const result = validateSearch({ etapa: 1, carta: uuid });
    expect(result).toMatchObject({ aba: "elenco", dialogo: "editar-jogador", id: uuid });
  });

  it("traduz etapa=3 para aba=jogos com visao=presenca", () => {
    expect(validateSearch({ etapa: 3 })).toMatchObject({ aba: "jogos", visao: "presenca" });
  });

  it("traduz etapa=4 para aba=jogos com visao=times", () => {
    expect(validateSearch({ etapa: 4 })).toMatchObject({ aba: "jogos", visao: "times" });
  });
});

describe("estado mobile — legado validateHomeSearch (mantido para compatibilidade)", () => {
  it("valida e limita os parâmetros de navegação antigos", () => {
    expect(validateHomeSearch({ etapa: "4", jogo: "not-valid" })).toEqual({ etapa: 4 });
    expect(validateHomeSearch({ etapa: "2", carta: "novo" })).toEqual({ etapa: 2, carta: "novo" });
  });
});

describe("estado mobile — rascunhos e sorteio", () => {
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
