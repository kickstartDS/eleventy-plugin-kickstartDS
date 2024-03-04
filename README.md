## Eleventy Plugin Template

> A starter environment for creating plugins for Eleventy (11ty).

Fork this repo, or select "Use this template" to get started.

### Using this template

This template is setup to run a single page 11ty site for testing your plugin functionality. The build files are excluded from the final plugin package via `.npmignore`.

Your plugin functionality should live in/be exported from `.eleventy.js`. You will find a sample of creating a filter plugin in this template, including setting up a default config and merging user options.

**Be sure to update the `package.json` with your own details!**

### Testing your plugin

You can test your functionality within this project's local 11ty build by running `npm start`, but you'll also want to test it _as a plugin_.

From another local 11ty project, you can set the `require()` path relatively to your plugin's project directory, and then use it just as you would for a plugin coming from a package.

Example, assuming you place all your repositories within the same parent directory:

```js
const pluginName = require("../plugin-directory");

module.exports = (eleventyConfig) => {
  eleventyConfig.addPlugin(pluginName, { optionName: 'if needed' );
};
```

Then, run the project to test the plugin's functionality.

Note that making changes in the plugin source will likely require restarting the test project.

### Resources for creating an 11ty plugin

- Bryan Robinson's ["Create a Plugin with 11ty"](https://www.youtube.com/watch?v=aO-NFFKjnnE) demonstration on "Learn With Jason"

---

**The following is a boilerplate for your final plugin README**.

## Usage

Describe how to install your plugin, such as:

```bash
npm install @scope/plugin-name
```

Then, include it in your `.eleventy.js` config file:

```js
const pluginName = require("@scope/plugin-name");

module.exports = (eleventyConfig) => {
  eleventyConfig.addPlugin(pluginName);
};
```

## Config Options

| Option      | Type | Default       |
| ----------- | ---- | ------------- |
| option name | type | default value |

## Config Examples

Show examples of likely configurations.

## Contributing

Contributions are welcome. Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as below, without any additional terms or conditions.

## License

This project is licensed under either of

- [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0) ([LICENSE-APACHE](LICENSE-APACHE))
- [MIT license](https://opensource.org/license/mit/) ([LICENSE-MIT](LICENSE-MIT))

at your option.

The SPDX license identifier for this project is MIT OR Apache-2.0.

---

For more information and updates, please visit the project's GitHub repository.

## Support

Join our [Discord community](https://discord.gg/mwKzD5gejY) for support, or leave an issue on this repository!
