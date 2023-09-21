import { UserConfig } from "@11ty/eleventy";
import { renderToStaticMarkup } from "react-dom/server";
import { FC, ReactElement } from "react";
import { BuildContext, BuildOptions, BuildFailure } from "esbuild";
import { createPageContext, bundlePage } from "./src/page";
import { bundleClientJs, bundleClientCss } from "./src/clientAssets";
import { injectInline } from "./src/injectInline";
import { injectBundle } from "./src/injectBundle";
import { renderErrorHtml, RenderError } from "./src/error";

type EleventyEvent = {
  dir: {
    input: string;
    output: string;
    includes: string;
    data: string;
    layouts?: string;
  };
  outputMode: "fs" | "json" | "ndjson";
  runMode: "serve" | "watch" | "build";
};
type EleventyAfterEvent = EleventyEvent & {
  results: {
    inputPath: string;
    outputPath: string;
    url: string;
    content: string;
  }[];
};

const isEsbuildError = (error: any): error is BuildFailure =>
  error && error.errors && error.warnings;

export type Options = {
  inline?: boolean;
  templateBuildOptions?: (options: BuildOptions) => BuildOptions;
};

module.exports = function kdsPlugin(
  eleventyConfig: UserConfig,
  options: Options = {},
) {
  const { inline = false, templateBuildOptions = (o) => o } = options;
  let runMode: "serve" | "watch" | "build";

  eleventyConfig.addTemplateFormats("jsx");
  eleventyConfig.addTemplateFormats("tsx");

  const pageMap = new Map<
    string,
    | {
        component: FC<any>;
        deps: string[];
        clientJs: string[];
        clientCss: string[];
      }
    | RenderError[]
  >();
  const pageContexts = new Map<string, BuildContext>();

  eleventyConfig.on("eleventy.before", (event: EleventyEvent) => {
    runMode = event.runMode;
  });

  eleventyConfig.on(
    "eleventy.after",
    async ({ results, runMode, dir }: EleventyAfterEvent) => {
      if (inline) {
        for (const { inputPath, content, outputPath } of results) {
          const page = pageMap.get(inputPath);
          if (page && !Array.isArray(page)) {
            await injectInline(content, inputPath, outputPath, page);
          }
        }
      } else {
        const clientJsImports: [string, string[]][] = [];
        const pageClientCssImports: string[] = [];

        for (const [inputPath, page] of pageMap) {
          if (!Array.isArray(page)) {
            clientJsImports.push([inputPath, page.clientJs]);
            pageClientCssImports.push(...page.clientCss);
          }
        }

        const [jsPaths, jsClientCssImports] = await bundleClientJs(
          clientJsImports,
          dir.output,
        );

        const cssPath = await bundleClientCss(
          [...new Set([...jsClientCssImports, ...pageClientCssImports])],
          dir.output,
        );

        for (const { inputPath, content, outputPath } of results) {
          if (pageMap.has(inputPath)) {
            await injectBundle(
              content,
              outputPath,
              jsPaths[inputPath],
              cssPath,
            );
          }
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
      if (!pageContexts.has(inputPath)) {
        pageContexts.set(
          inputPath,
          await createPageContext(inputPath, templateBuildOptions),
        );
      }
      const ctx = pageContexts.get(inputPath);
      if (!ctx) {
        throw `could not find page context for ${inputPath}`;
      }

      try {
        const result = await ctx.rebuild();
        const { data, ...page } = bundlePage(result, inputPath);
        pageMap.set(inputPath, page);
        return { data };
      } catch (error) {
        if (
          runMode === "serve" &&
          isEsbuildError(error) &&
          error.errors.length
        ) {
          pageMap.set(
            inputPath,
            error.errors.map((e) => ({
              fileName: e.location?.file,
              message: e.text,
              ...e.location,
            })),
          );
          return { data: {} };
        }
        throw error;
      }
    },

    async compile(content: string, inputPath: string) {
      const page = pageMap.get(inputPath);
      if (!page) {
        throw `could not find page for ${inputPath}`;
      }

      if (Array.isArray(page)) {
        return () => page.map((error) => renderErrorHtml(error)).join("\n");
      }

      const { component, deps } = page;
      this.addDependencies(inputPath, deps);

      return (data: any) => {
        try {
          return renderToStaticMarkup(component(data) as ReactElement);
        } catch (error) {
          if (runMode === "serve") {
            console.error(error);
            return renderErrorHtml({
              fileName: inputPath,
              message: String(error),
            });
          }
          throw error;
        }
      };
    },
  });
};
