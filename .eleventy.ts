import { UserConfig } from "@11ty/eleventy";
import { renderToStaticMarkup } from "react-dom/server";
import { FC, ReactElement } from "react";
import { BuildContext } from "esbuild";
import { createPageContext, bundlePage } from "./src/page";
import { inject } from "./src/inject";

type EleventyAfterEvent = {
  dir: {
    input: string;
    output: string;
    includes: string;
    data: string;
    layouts?: string;
  };
  outputMode: "fs" | "json" | "ndjson";
  runMode: "serve" | "watch" | "build";
  results: {
    inputPath: string;
    outputPath: string;
    url: string;
    content: string;
  }[];
};

export type Options = {
  ignore?: string[];
};

module.exports = function kdsPlugin(
  eleventyConfig: UserConfig,
  options: Options = {},
) {
  const { ignore = [] } = options;
  const shouldIgnore = (inputPath: string) => {
    for (const ignorePath of ignore) {
      if (inputPath.startsWith(ignorePath)) {
        return true;
      }
    }
    return false;
  };

  eleventyConfig.addTemplateFormats("jsx");
  eleventyConfig.addTemplateFormats("tsx");

  const pageMap = new Map<
    string,
    {
      component: FC<any>;
      deps: string[];
      clientAssets: Set<string>;
    }
  >();
  const pageContexts = new Map<string, BuildContext>();

  eleventyConfig.on(
    "eleventy.after",
    ({ results, runMode }: EleventyAfterEvent) => {
      for (const { inputPath, content, outputPath } of results) {
        const page = pageMap.get(inputPath);
        if (page) {
          inject(content, inputPath, outputPath, page.clientAssets);
        }
      }
      if (runMode === "build") {
        for (const [, ctx] of pageContexts) {
          ctx.dispose();
        }
      }
    },
  );

  eleventyConfig.addExtension(["jsx", "tsx"], {
    read: false,
    getData: true,
    compileOptions: {
      // TODO: enable cache when deps watching is fixed
      // https://github.com/11ty/eleventy/issues/2999
      cache: false,
    },

    async getInstanceFromInputPath(inputPath: string) {
      if (shouldIgnore(inputPath)) {
        return { data: { eleventyExcludeFromCollections: true } };
      }

      if (!pageContexts.has(inputPath)) {
        pageContexts.set(inputPath, await createPageContext(inputPath));
      }
      const ctx = pageContexts.get(inputPath);
      if (!ctx) {
        throw `could not find page context for ${inputPath}`;
      }
      const result = await ctx.rebuild();
      const { data, ...page } = bundlePage(result, inputPath);
      pageMap.set(inputPath, page);
      return { data };
    },

    async compile(content: string, inputPath: string) {
      if (shouldIgnore(inputPath)) return;

      const page = pageMap.get(inputPath);
      if (!page) {
        throw `could not find page for ${inputPath}`;
      }
      const { component, deps } = page;
      this.addDependencies(inputPath, deps);

      return (data: any) =>
        renderToStaticMarkup(component(data) as ReactElement);
    },
  });
};
