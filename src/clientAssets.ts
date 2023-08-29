import path from "path";
import esbuild, { Metafile } from "esbuild";
import lightningcss from "lightningcss";
import { esbuildTargets, lightningcssTargets } from "./browserTargets";

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

function minifyCss(code: Uint8Array | undefined, inputPath: string) {
  if (code) {
    const cssFileName =
      path.basename(inputPath, path.extname(inputPath)) + ".css";
    return lightningcss.transform({
      code,
      minify: true,
      targets: lightningcssTargets,
      filename: path.join(path.dirname(inputPath), cssFileName),
    }).code;
  }
}

export function findClientAssets(
  name: string,
  inputs: Metafile["inputs"],
  clientAssets = new Set<string>(),
) {
  if (inputs[name]?.imports.length) {
    for (const i of inputs[name].imports) {
      if (
        (i.path.endsWith(".js") &&
          (i.path.endsWith(".client.js") || kds_exports.includes(i.path))) ||
        i.path.endsWith(".css")
      ) {
        clientAssets.add(i.path);
      } else {
        findClientAssets(i.path, inputs, clientAssets);
      }
    }
  }
  return clientAssets;
}

export async function bundleClientAssets(
  clientAssets: Set<string>,
  inputPath: string,
) {
  const clientResult = await esbuild.build({
    stdin: {
      contents: [...clientAssets]
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

  return {
    js: clientResult.outputFiles[0]?.contents,
    css: minifyCss(clientResult.outputFiles[1]?.contents, inputPath),
  };
}
