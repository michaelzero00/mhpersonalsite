const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

module.exports = function (eleventyConfig) {
  const videosPath = path.join(process.cwd(), "src", "_data", "videos.json");
  const processorPath = path.join(process.cwd(), "scripts", "process-images.mjs");
  let lastVideosMtime = 0;

  const getVideosMtime = () => {
    try {
      return fs.statSync(videosPath).mtimeMs;
    } catch {
      return 0;
    }
  };

  const runImageProcessor = () => {
    const result = spawnSync(process.execPath, [processorPath], {
      stdio: "inherit",
    });
    if (result.status !== 0) {
      throw new Error("Image processing failed while handling videos.json.");
    }
  };

  eleventyConfig.addWatchTarget("src/_data/videos.json");

  eleventyConfig.on("eleventy.before", () => {
    const currentMtime = getVideosMtime();
    if (currentMtime === lastVideosMtime) return;
    lastVideosMtime = currentMtime;
    runImageProcessor();
  });

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  const pathPrefix = process.env.ELEVENTY_PATH_PREFIX || "/";

  return {
    pathPrefix,
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes",
      data: "_data",
    },
  };
};
