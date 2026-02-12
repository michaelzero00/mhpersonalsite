#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const videosPath = path.join(projectRoot, "src", "_data", "videos.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function commandExists(command) {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function runCommand(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || "Unknown conversion error";
    throw new Error(`${command} failed: ${stderr}`);
  }
}

function readSignature(filePath, length = 8) {
  const fd = fs.openSync(filePath, "r");
  const buffer = Buffer.alloc(length);
  fs.readSync(fd, buffer, 0, length, 0);
  fs.closeSync(fd);
  return buffer;
}

function isPng(filePath) {
  const signature = readSignature(filePath);
  return signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

function isJpeg(filePath) {
  const signature = readSignature(filePath, 3);
  return signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
}

function detectImageType(filePath) {
  if (isPng(filePath)) return "png";
  if (isJpeg(filePath)) return "jpeg";
  return "other";
}

function shouldGenerate(sourcePath, outputPath) {
  if (!fileExists(outputPath)) return true;
  const sourceTime = fs.statSync(sourcePath).mtimeMs;
  const outputTime = fs.statSync(outputPath).mtimeMs;
  return sourceTime > outputTime;
}

function convertWithFfmpeg(sourcePath, jpgPath, webpPath) {
  if (shouldGenerate(sourcePath, webpPath)) {
    runCommand("ffmpeg", ["-y", "-i", sourcePath, "-q:v", "70", webpPath]);
  }
  if (shouldGenerate(sourcePath, jpgPath)) {
    runCommand("ffmpeg", ["-y", "-i", sourcePath, "-q:v", "3", jpgPath]);
  }
}

function convertWithSipsAndCwebp(sourcePath, jpgPath, webpPath) {
  if (shouldGenerate(sourcePath, jpgPath)) {
    runCommand("sips", ["-s", "format", "jpeg", sourcePath, "--out", jpgPath]);
  }
  if (shouldGenerate(sourcePath, webpPath)) {
    runCommand("cwebp", ["-q", "75", sourcePath, "-o", webpPath]);
  }
}

function convertJpegToWebp(converter, sourcePath, webpPath) {
  if (!shouldGenerate(sourcePath, webpPath)) return;
  if (converter === "ffmpeg") {
    runCommand("ffmpeg", ["-y", "-i", sourcePath, "-q:v", "70", webpPath]);
  } else {
    runCommand("cwebp", ["-q", "75", sourcePath, "-o", webpPath]);
  }
}

function pickConverter() {
  if (commandExists("ffmpeg")) return "ffmpeg";
  if (commandExists("sips") && commandExists("cwebp")) return "sips-cwebp";
  throw new Error(
    "No supported image converter found. Install ffmpeg, or install both sips and cwebp."
  );
}

function toPublicPath(localPath) {
  const assetsRoot = path.join(projectRoot, "src");
  const relative = path.relative(assetsRoot, localPath);
  return `/${relative.split(path.sep).join("/")}`;
}

function resolveInputPath(imagePath) {
  if (imagePath.startsWith("/")) {
    return path.join(projectRoot, "src", imagePath.replace(/^\//, ""));
  }
  if (imagePath.startsWith("assets/")) {
    return path.join(projectRoot, "src", imagePath);
  }
  return path.join(projectRoot, "src", "assets", "images", imagePath);
}

function main() {
  const converter = pickConverter();
  const videos = readJson(videosPath);
  let processed = 0;
  let updatedData = false;

  for (const video of videos) {
    if (!video.image) continue;

    const inputPath = resolveInputPath(video.image);
    if (!fileExists(inputPath)) {
      console.warn(`Skipping missing file: ${video.image}`);
      continue;
    }

    const parsed = path.parse(inputPath);
    const imageType = detectImageType(inputPath);
    if (imageType === "other") continue;

    const webpPath = path.join(parsed.dir, `${parsed.name}.webp`);
    let nextImage = toPublicPath(inputPath);
    let nextWebp = toPublicPath(webpPath);

    if (imageType === "png") {
      const jpgPath = path.join(parsed.dir, `${parsed.name}.jpg`);
      if (converter === "ffmpeg") {
        convertWithFfmpeg(inputPath, jpgPath, webpPath);
      } else {
        convertWithSipsAndCwebp(inputPath, jpgPath, webpPath);
      }
      nextImage = toPublicPath(jpgPath);
      nextWebp = toPublicPath(webpPath);
    } else {
      convertJpegToWebp(converter, inputPath, webpPath);
    }

    if (video.image !== nextImage || video.imageWebp !== nextWebp) {
      video.image = nextImage;
      video.imageWebp = nextWebp;
      updatedData = true;
    }

    processed += 1;
  }

  if (updatedData) {
    writeJson(videosPath, videos);
  }

  console.log(
    `Processed ${processed} PNG/JPEG image${processed === 1 ? "" : "s"} using ${converter}.`
  );
}

main();
