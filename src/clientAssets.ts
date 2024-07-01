import fs from "fs";
import path from "path";
import esbuild, { Metafile, Plugin } from "esbuild";
import { sassPlugin, SassPluginOptions } from "esbuild-sass-plugin";
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

export function minifyCss(code: Uint8Array | undefined, inputPath: string) {
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
  visited = new Set<string>(),
) {
  if (inputs[name]?.imports.length) {
    for (const i of inputs[name].imports) {
      if (!visited.has(i.path)) {
        visited.add(i.path);
        if (
          (i.path.endsWith(".js") &&
            (i.path.endsWith(".client.js") || kds_exports.includes(i.path))) ||
          i.path.endsWith(".css") ||
          i.path.endsWith(".scss")
        ) {
          clientAssets.add(i.path);
        } else {
          findClientAssets(i.path, inputs, clientAssets);
        }
      }
    }
  }
  return clientAssets;
}

function virtual(options: Record<string, string | Uint8Array> = {}): Plugin {
  const namespace = "virtual";
  const filter = new RegExp(
    Object.keys(options)
      .map((name) => `^${name}$`)
      .join("|"),
  );
  return {
    name: namespace,
    setup(build) {
      build.onResolve({ filter }, (args) => {
        return { path: args.path, namespace };
      });
      build.onLoad({ filter: /.*/, namespace }, (args) => {
        return {
          contents: options[args.path],
          loader: "js",
          resolveDir: process.cwd(),
        };
      });
    },
  };
}

export async function bundleClientJs(
  entries: [string, string[]][],
  outdir: string,
) {
  const outdirRe = new RegExp(`^${outdir}\/`);
  const entryPoints = Object.fromEntries(
    entries.map(([name, imports]) => [
      name,
      imports.map((scriptPath) => `import "./${scriptPath}";`).join(""),
    ]),
  );
  const result = await esbuild.build({
    entryPoints: Object.keys(entryPoints),
    entryNames: "[dir]/[name]-[hash]",
    bundle: true,
    outdir: outdir + "/_",
    minify: true,
    treeShaking: true,
    splitting: true,
    loader: { ".css": "empty", ".scss": "empty" },
    platform: "browser",
    format: "esm",
    metafile: true,
    target: esbuildTargets,
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
    plugins: [virtual(entryPoints)],
  });

  const entryImports: Record<string, { permalink: string; imports: string[] }> =
    Object.fromEntries(
      Object.entries(result.metafile.outputs)
        .filter(([, { entryPoint }]) => entryPoint?.startsWith("virtual:"))
        .map(([name, { entryPoint, imports }]) => [
          entryPoint?.replace("virtual:", ""),
          {
            permalink: name.replace(outdirRe, "/"),
            imports: imports
              .filter(({ kind }) => kind === "import-statement")
              .map(({ path }) => path.replace(outdirRe, "/")),
          },
        ]),
    );
  const cssInputs = Object.keys(result.metafile.inputs).filter((i) =>
    i.endsWith(".css"),
  );
  return [entryImports, cssInputs] as const;
}

export async function bundleClientCss(
  imports: string[],
  outdir: string,
  sassPluginOptions?: SassPluginOptions,
) {
  const result = await esbuild.build({
    stdin: {
      contents: imports.map((i) => `@import "${i}";`).join(""),
      resolveDir: process.cwd(),
      sourcefile: "index.css",
      loader: "css",
    },
    outdir: "/_",
    entryNames: "[dir]/index-[hash]",
    loader: { ".svg": "dataurl", ".woff2": "dataurl", ".woff": "dataurl" },
    plugins: [sassPlugin(sassPluginOptions)],
    write: false,
    bundle: true,
  });
  const [outputFile] = result.outputFiles;
  const css = minifyCss(outputFile.contents, outputFile.path);
  if (css) {
    const cssFileName = path.join(outdir, outputFile.path);
    const cssFileDir = path.dirname(cssFileName);
    if (!fs.existsSync(cssFileDir)) {
      fs.mkdirSync(cssFileDir);
    }
    fs.writeFileSync(cssFileName, css);
    return outputFile.path;
  }
}
