import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { decryptScsC, detectKind, type SiiKind } from "./crypto.ts";
import { decodeBsii } from "./bsii.ts";
import { parseSii, stringifySii, type SiiDocument } from "./model.ts";

export interface LoadedSii {
  path: string;
  kind: SiiKind;
  inner: SiiKind;
  doc: SiiDocument;
}

export function loadSii(path: string): LoadedSii {
  const raw = readFileSync(path);
  const kind = detectKind(raw);
  const payload = kind === "encrypted" ? decryptScsC(raw) : raw;
  const inner = detectKind(payload);
  if (inner === "binary") return { path, kind, inner, doc: decodeBsii(payload) };
  if (inner === "text") return { path, kind, inner, doc: parseSii(payload.toString("utf8")) };
  throw new Error(`${path}: unsupported payload format '${inner}'`);
}

export function saveSiiAsText(path: string, doc: SiiDocument, backup = true): void {
  if (backup && !existsSync(path + ".bak")) copyFileSync(path, path + ".bak");
  writeFileSync(path, stringifySii(doc), "utf8");
}
