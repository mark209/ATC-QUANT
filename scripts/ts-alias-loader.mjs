import { access } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, extname, join } from "node:path";
import ts from "typescript";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = pathToFileURL(join(process.cwd(), "src", specifier.slice(2))).href;
    return resolveTypeScript(target, context, nextResolve);
  }
  if (specifier.startsWith(".") && !extname(specifier)) {
    const target = new URL(specifier, context.parentURL).href;
    try { return await nextResolve(specifier, context); }
    catch { return resolveTypeScript(target, context, nextResolve); }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".ts") || url.endsWith(".tsx")) {
    const source = await readFile(fileURLToPath(url), "utf8");
    const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, sourceMap: false } });
    return { format: "module", source: result.outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}

async function resolveTypeScript(target, context, nextResolve) {
  const candidates = [target, `${target}.ts`, `${target}.tsx`, `${target}.js`];
  for (const candidate of candidates) {
    try { await access(fileURLToPath(candidate)); return nextResolve(candidate, context); }
    catch { /* continue */ }
  }
  return nextResolve(target, context);
}
