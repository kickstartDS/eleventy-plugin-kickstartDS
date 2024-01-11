import fs from "fs";
import esbuild from "esbuild";
import { sassPlugin } from "esbuild-sass-plugin";
import { esbuildTargets } from "./browserTargets";
import { minifyCss } from "./clientAssets";

async function bundleClientAssets(clientAssets: string[], inputPath: string) {
  const result = await esbuild.build({
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
    loader: { ".svg": "dataurl", ".woff2": "dataurl", ".woff": "dataurl" },
    platform: "browser",
    target: esbuildTargets,
    plugins: [sassPlugin()],
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
  });

  return {
    js: result.outputFiles[0]?.contents,
    css: minifyCss(result.outputFiles[1]?.contents, inputPath),
  };
}

export async function injectInline(
  content: string,
  inputPath: string,
  outputPath: string,
  { clientCss, clientJs }: { clientCss: string[]; clientJs: string[] },
) {
  let newContent = content;

  const { js, css } = await bundleClientAssets(
    [...clientCss, ...clientJs],
    inputPath,
  );
  if (css) {
    newContent = newContent.replace("</head>", `<style>${css}</style></head>`);
  }
  if (js) {
    newContent = newContent.replace(
      "</body>",
      `<script type="module">${Buffer.from(js)}</script></body>`,
    );
  }

  if (newContent !== content) {
    fs.writeFileSync(outputPath, newContent);
  }
}
