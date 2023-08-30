import { FC } from "react";
import esbuild, { BuildOptions, BuildResult } from "esbuild";
import { findClientAssets } from "./clientAssets";

export async function createPageContext(inputPath: string) {
  const options: BuildOptions = {
    stdin: {
      contents: `
          import * as Page from "${inputPath}";
          import { EleventyContext } from "@kickstartds/eleventy-plugin-kickstartds/useEleventy";
          page = {
            component: (data) => <EleventyContext.Provider value={data}><Page.default {...data} /></EleventyContext.Provider>,
            data: Page.data,
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
    external: ["react", "react-dom"],
    metafile: true,
    platform: "node",
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
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
  inputPath: string,
) {
  const page: { component: FC<any>; data: any } = new Function(
    "require",
    result.outputFiles[0].text + " return page;",
  )(require);

  const deps = Object.keys(result.metafile.inputs)
    .filter(
      (dep) =>
        dep !== "<stdin>" &&
        dep !== inputPath.slice(2) &&
        !dep.startsWith("node_modules/"),
    )
    .map((dep) => "./" + dep);

  const clientAssets = findClientAssets(
    inputPath.slice(2),
    result.metafile.inputs,
  );
  return {
    component: page.component,
    data: page.data,
    clientAssets,
    deps,
  };
}
