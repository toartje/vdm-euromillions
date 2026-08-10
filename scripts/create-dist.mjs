import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const distDir = path.join(rootDir, "dist");
const bundleDir = path.join(distDir, "bundle");
const standaloneDir = path.join(rootDir, ".next", "standalone");
const staticDir = path.join(rootDir, ".next", "static");
const publicDir = path.join(rootDir, "public");
const openAiDir = path.join(rootDir, ".openai");
  const rootBundleDir = path.join(rootDir, "bundle");
  const distNextDir = path.join(distDir, "node_modules", "next");
  const distServerNodeModulesDir = path.join(distDir, "server", "node_modules");

const bundlePackageJson = JSON.stringify(
  {
    name: "bundle",
    private: true,
    type: "commonjs",
    main: "./next.js",
    exports: {
      "./next": "./next.js"
    }
  },
  null,
  2
);

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(standaloneDir))) {
    throw new Error("Next standalone output ontbreekt. Controleer of output: 'standalone' actief is.");
  }

  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  await cp(standaloneDir, distDir, { recursive: true });

  const rootBundleShimDirs = [
    rootBundleDir,
    path.join(rootDir, "node_modules", "bundle"),
  ];
  for (const rootBundleShimDir of rootBundleShimDirs) {
    await mkdir(rootBundleShimDir, { recursive: true });
    await writeFile(path.join(rootBundleShimDir, "package.json"), bundlePackageJson);
    await writeFile(path.join(rootBundleShimDir, "next.js"), `module.exports = require("next");\n`);
  }

  // Keep the bundle shim tiny so the Sites archive stays under the upload limit and deploys reliably.
  const bundleShimDirs = [
    path.join(distDir, "bundle"),
    path.join(distDir, "server", "bundle"),
    path.join(distDir, "node_modules", "bundle"),
    path.join(distDir, "server", "node_modules", "bundle"),
    path.join(distDir, "node_modules", "next", "node_modules", "bundle"),
    path.join(distDir, "server", "node_modules", "next", "node_modules", "bundle"),
  ];
  for (const bundleShimDir of bundleShimDirs) {
    await mkdir(bundleShimDir, { recursive: true });
    await writeFile(path.join(bundleShimDir, "package.json"), bundlePackageJson);
    await writeFile(
      path.join(bundleShimDir, "next.js"),
      `module.exports = require("next");\n`
    );
  }

  if (await exists(distNextDir)) {
    await mkdir(path.join(distServerNodeModulesDir, "next"), { recursive: true });
    await cp(distNextDir, path.join(distServerNodeModulesDir, "next"), { recursive: true });
  }

  const distServerDir = path.join(distDir, "server");
  await mkdir(distServerDir, { recursive: true });
  const rootServerSource = await readFile(path.join(distDir, "server.js"), "utf8");
  const serverSource = rootServerSource
    .replace("module.createRequire(import.meta.url)", 'module.createRequire(path.join(process.cwd(), "server.js"))')
    .replace("fileURLToPath(new URL('.', import.meta.url))", "process.cwd()");
  const bundleAlias = `
const bundleNextPath = path.join(__dirname, "bundle", "next.js")
const originalResolveFilename = module._resolveFilename
module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "bundle/next") {
    return bundleNextPath
  }

  return originalResolveFilename.call(this, request, parent, isMain, options)
}
`;
  const aliasedServerSource = serverSource.replace(
    "const dir = path.join(__dirname)\n",
    `const dir = path.join(__dirname)\n${bundleAlias}\n`
  );
  await writeFile(path.join(distServerDir, "server.js"), aliasedServerSource);
  await writeFile(
    path.join(distServerDir, "index.js"),
    `await import("./server.js");
`
  );

  const distStaticDir = path.join(distDir, ".next", "static");
  await mkdir(path.dirname(distStaticDir), { recursive: true });
  if (await exists(staticDir)) {
    await cp(staticDir, distStaticDir, { recursive: true });
  }

  const distPublicDir = path.join(distDir, "public");
  if (await exists(publicDir)) {
    await cp(publicDir, distPublicDir, { recursive: true });
  }

  const distOpenAiDir = path.join(distDir, ".openai");
  if (await exists(openAiDir)) {
    await cp(openAiDir, distOpenAiDir, { recursive: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
