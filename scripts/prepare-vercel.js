const path = require("path");
const { copyFile, mkdir, readdir, rm } = require("fs").promises;

const projectRoot = path.resolve(__dirname, "..");
const frontendDirectory = path.join(projectRoot, "frontend");
const publicDirectory = path.join(projectRoot, "public");

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

async function buildStaticFrontend() {
  await rm(publicDirectory, { recursive: true, force: true });
  await copyDirectory(frontendDirectory, publicDirectory);
}

buildStaticFrontend().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
