import fs from "fs";
import { bundleClientAssets } from "./clientAssets";

export async function inject(
  content: string,
  inputPath: string,
  outputPath: string,
  clientAssets: Set<string>,
) {
  let newContent = content;

  const { js, css } = await bundleClientAssets(clientAssets, inputPath);
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
