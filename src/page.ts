import path from "path";
import { FC } from "react";
import esbuild, { BuildOptions, BuildResult } from "esbuild";
import { sassPlugin } from "esbuild-sass-plugin";
import { nodeExternalsPlugin } from "esbuild-node-externals";
import lightningcss from "lightningcss";
import { lightningcssTargets } from "./browserTargets";
import { findClientScripts } from "./clientScripts";

export async function createPageContext(inputPath: string) {
  const options: BuildOptions = {
    stdin: {
      contents: `
          import * as Page from "${inputPath}";
          import { FrontmatterContext } from "@kickstartds/eleventy-plugin-kickstartds/frontmatter";
          page = {
            component: (data) => <FrontmatterContext.Provider value={data}><Page.default {...data} /></FrontmatterContext.Provider>,
            frontmatter: Page.frontmatter,
          };
        `,
      resolveDir: process.cwd(),
      loader: "jsx",
    },
    jsx: "automatic",
    write: false,
    bundle: true,
    outdir: ".",
    treeShaking: true,
    loader: { ".svg": "dataurl" },
    plugins: [
      sassPlugin(),
      nodeExternalsPlugin({
        allowList: [
          "@kickstartds/core",
          "@kickstartds/base",
          "@kickstartds/content",
          "@kickstartds/form",
        ],
      }),
    ],
    metafile: true,
    platform: "node",
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    }
  };
  if (process.env.NODE_ENV !== "production") {
    options.alias = {
      "@kickstartds/eleventy-plugin-kickstartds": ".",
    };
  }
  return esbuild.context(options);
}

export function bundlePage(
  result: BuildResult<{ write: false; metafile: true }>,
  inputPath: string
) {
  const page: { component: FC<any>; frontmatter: any } = new Function(
    "require",
    result.outputFiles[0].text + " return page;"
  )(require);

  const deps = Object.keys(result.metafile.inputs)
    .filter(
      (dep) =>
        dep !== "<stdin>" &&
        dep !== inputPath.slice(2) &&
        !dep.startsWith("node_modules/")
    )
    .map((dep) => "./" + dep);

  /** @type {string[]} */
  const clientScripts: string[] = [];
  findClientScripts(inputPath.slice(2), clientScripts, result.metafile.inputs);

  const cssFileName =
    path.basename(inputPath, path.extname(inputPath)) + ".css";
  const { code: css } = lightningcss.transform({
    code: Buffer.from(result.outputFiles[1]?.text || ""),
    minify: true,
    targets: lightningcssTargets,
    filename: path.join(path.dirname(inputPath), cssFileName),
  });

  return {
    component: page.component,
    data: page.frontmatter,
    css,
    clientScripts,
    deps,
  };
}
