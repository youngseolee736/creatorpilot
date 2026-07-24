const path = require("path");
const { copyFile, mkdir, readdir, rm, stat } = require("fs").promises;

const projectRoot = path.resolve(__dirname, "..");
const frontendDirectory = path.join(projectRoot, "frontend");
const publicDirectory = path.join(projectRoot, "public");
const publicEntries = [
  "app.js",
  "config.js",
  "favicon.svg",
  "index.html",
  "lib",
  "pages",
  "services",
  "styles.css",
  "ui",
];

async function copyDirectory(source, destination) {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });

  await Promise.all(entries.map(async (entry) => {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
      return;
    }

    await copyFile(sourcePath, destinationPath);
  }));
}

async function copyEntry(entry) {
  const source = path.join(frontendDirectory, entry);
  const destination = path.join(publicDirectory, entry);
  const sourceStat = await stat(source);

  if (sourceStat.isDirectory()) {
    await copyDirectory(source, destination);
    return;
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

async function buildStaticFrontend() {
  await rm(publicDirectory, { recursive: true, force: true });
  await mkdir(publicDirectory, { recursive: true });
  await Promise.all(publicEntries.map(copyEntry));
}

buildStaticFrontend().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
