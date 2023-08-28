import { UserConfig } from "@11ty/eleventy";
import { renderToStaticMarkup } from "react-dom/server";
import { FC, ReactElement } from "react";
import { BuildContext } from "esbuild";
import { bundleClientScripts } from "./src/clientScripts";
import { createPageContext, bundlePage } from "./src/page";

module.exports = function kdsPlugin(
  eleventyConfig: UserConfig,
  options: { ignore?: string[] } = {},
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
      css: Uint8Array;
      clientScripts: string[];
      deps: string[];
    }
  >();
  const pageContexts = new Map<string, BuildContext>();

  eleventyConfig.on(
    "eleventy.after",
    ({ runMode }: { runMode: "serve" | "watch" | "build" }) => {
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
      const { component, clientScripts, css, deps } = page;
      this.addDependencies(inputPath, deps);

      return async (data: any) => {
        const html = renderToStaticMarkup(component(data) as ReactElement);
        const js = await bundleClientScripts(clientScripts);

        return `${
          css ? `<style>${css}</style>` : ""
        } ${html} <script type="module">${js}</script>`;
      };
    },
  });
};
