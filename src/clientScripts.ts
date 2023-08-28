import esbuild, { Metafile } from "esbuild";
import { esbuildTargets } from "./browserTargets";

const kds_exports = ["core", "base", "blog", "form", "content"].reduce(
  (prev, curr) => {
    try {
      const exp = Object.keys(
        require(`@kickstartds/${curr}/lib/exports.json`),
      ).map((e) => `node_modules/@kickstartds/${curr}/lib/` + e);
      return prev.concat(exp);
    } catch (e) {
      return prev;
    }
  },
  [] as string[],
);

export function findClientScripts(
  name: string,
  clientScripts: string[],
  inputs: Metafile["inputs"],
) {
  if (inputs[name]?.imports.length) {
    for (const i of inputs[name].imports) {
      if (
        i.path.endsWith(".js") &&
        (i.path.endsWith(".client.js") || kds_exports.includes(i.path))
      ) {
        clientScripts.push(i.path);
      } else {
        findClientScripts(i.path, clientScripts, inputs);
      }
    }
  }
}

export async function bundleClientScripts(clientScripts: string[]) {
  const clientResult = await esbuild.build({
    stdin: {
      contents: clientScripts
        .map((scriptPath) => `import "./${scriptPath}";`)
        .join(""),
      resolveDir: process.cwd(),
      loader: "js",
    },
    write: false,
    bundle: true,
    outdir: ".",
    minify: true,
    treeShaking: true,
    platform: "browser",
    target: esbuildTargets,
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
  });

  return clientResult.outputFiles[0].text;
}
