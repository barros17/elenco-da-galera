export function withoutDialog<T extends { dialogo?: unknown; id?: unknown }>(search: T) {
  const { dialogo: _dialogo, id: _id, ...rest } = search;
  return rest;
}
