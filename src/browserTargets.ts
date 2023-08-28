import browserslist from "browserslist";
import browserslistToEsbuild from "browserslist-to-esbuild";
import lightningcss from "lightningcss";

const browsers = browserslist();
export const esbuildTargets = browserslistToEsbuild(browsers);
export const lightningcssTargets = lightningcss.browserslistToTargets(browsers);
