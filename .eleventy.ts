import { UserConfig } from "@11ty/eleventy";
import { renderToStaticMarkup } from "react-dom/server";
import { FC, ReactElement } from "react";
import { BuildContext, BuildOptions, BuildFailure } from "esbuild";
import { SassPluginOptions } from "esbuild-sass-plugin";
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
  sassPluginOptions?: SassPluginOptions;
};

module.exports = function kdsPlugin(
  eleventyConfig: UserConfig,
  options: Options = {},
) {
  const {
    inline = false,
    templateBuildOptions = (o) => o,
    sassPluginOptions,
  } = options;
  let runMode: "serve" | "watch" | "build";
  let assetsCache:
    | Promise<{
        jsPaths: Record<
          string,
          {
            permalink: string;
            imports: string[];
          }
        >;
        cssPath: string | undefined;
      }>
    | undefined;

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
  const inputPathByOutputPath: Record<string, string> = {};
  const getSiteAssets = () => {
    if (assetsCache) {
      return assetsCache;
    }

    return (assetsCache = new Promise(async (resolve) => {
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
        eleventyConfig.dir.output,
      );

      const cssPath = await bundleClientCss(
        [...new Set([...jsClientCssImports, ...pageClientCssImports])],
        eleventyConfig.dir.output,
        sassPluginOptions,
      );
      resolve({ jsPaths, cssPath });
    }));
  };

  eleventyConfig.on("eleventy.before", (event: EleventyEvent) => {
    runMode = event.runMode;
    assetsCache = undefined;
  });

  eleventyConfig.on("eleventy.after", ({ runMode }: EleventyAfterEvent) => {
    if (runMode === "build") {
      for (const [, ctx] of pageContexts) {
        ctx.dispose();
      }
    }
  });

  eleventyConfig.addTemplateFormats("jsx");
  eleventyConfig.addTemplateFormats("tsx");
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
          const html = renderToStaticMarkup(component(data) as ReactElement);
          inputPathByOutputPath[data.page.outputPath] = inputPath;
          return html;
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

  eleventyConfig.addTransform(
    "jsx-inject-assets",
    async function (content: string, outputPath: string) {
      const inputPath = inputPathByOutputPath[outputPath];
      const page = pageMap.get(inputPath);

      if (!page || Array.isArray(page)) {
        return content;
      }

      if (inline) {
        return await injectInline(content, inputPath, page);
      } else {
        const { jsPaths, cssPath } = await getSiteAssets();
        return await injectBundle(content, jsPaths[inputPath], cssPath);
      }
    },
  );
};
