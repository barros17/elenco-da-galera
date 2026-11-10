import { describe, expect, it } from "vitest";
import { withoutDialog } from "./navigation";

describe("withoutDialog", () => {
  it("remove o diálogo e o id, preservando os demais parâmetros", () => {
    expect(
      withoutDialog({ aba: "elenco", dialogo: "editar-jogador", id: "p1", jogo: "j1" }),
    ).toEqual({
      aba: "elenco",
      jogo: "j1",
    });
  });
});
