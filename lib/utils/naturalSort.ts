// lib/utils/naturalSort.ts
export function naturalSortKey(filename: string) {
  const s = filename.toLowerCase();
  const parts = s.match(/\d+|\D+/g) || [s];
  return parts
    .map(p => (/\d+/.test(p) ? p.padStart(16, "0") : p))
    .join("");
}

export function sortImagesByFilename<T extends { filename: string }>(arr: T[]) {
  return [...arr].sort((a, b) => {
    const ka = naturalSortKey(a.filename);
    const kb = naturalSortKey(b.filename);
    return ka.localeCompare(kb);
  });
}
