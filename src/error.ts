const htmlEncode = (raw: string) =>
  raw.replace(/[\u00A0-\u9999<>\&]/g, (i) => `&#${i.charCodeAt(0)};`);

export type RenderError = {
  fileName?: string;
  message: string;
  lineText?: string;
  line?: number;
  column?: number;
  length?: number;
};

export const renderErrorHtml = ({
  fileName,
  message,
  lineText,
  line,
  column,
  length = 1,
}: RenderError) => {
  const location = line != null && column != null ? `:${line}:${column}` : "";
  const codeSnippet =
    line != null && column != null && lineText
      ? "<pre style='padding: .5em .5em .25em; background: darkslategray; color: white; overflow: auto;'>" +
        htmlEncode(lineText) +
        "\n" +
        "".padStart(length, "^").padStart(column + length, " ") +
        "</pre>"
      : "";

  return `
<div style="font-family: monospace;">
  <p style="font-size: 1rem;">${htmlEncode(message)}</p>
  ${fileName ? `<p>${fileName}${location}</p>` : ""}
  ${codeSnippet}
</div>`;
};
