export async function injectBundle(
  content: string,
  jsPath: { permalink: string; imports: string[] } | undefined,
  cssPath: string | undefined,
) {
  let newContent = content;

  if (jsPath) {
    newContent = newContent
      .replace(
        "</head>",
        jsPath.imports
          .map((href) => `<link rel="preload" href="${href}" />`)
          .join("") + "</head>",
      )
      .replace(
        "</body>",
        `<script type="module" src="${jsPath.permalink}"></script>`,
      );
  }
  if (cssPath) {
    newContent = newContent.replace(
      "</head>",
      `<link rel="stylesheet" href="${cssPath}" /></head>`,
    );
  }

  return newContent;
}
