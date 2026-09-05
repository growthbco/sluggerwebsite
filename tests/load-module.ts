import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";

/** Execute the actual route/helper against explicit, in-memory dependencies.
 * Missing application mocks fail closed: never reach production services. */
export function loadModule<T>(path: string, mocks: Record<string, unknown>): T {
  const filename = resolve(path);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const localRequire = createRequire(filename);
  const testModule = { exports: {} };
  const run = vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename });
  run((id: string) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith("@/") || id.startsWith(".")) throw new Error(`Unmocked application dependency: ${id}`);
    return localRequire(id);
  }, testModule, testModule.exports);
  return testModule.exports as T;
}
