const esbuild = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

async function main() {
    const ctx = await esbuild.context({
        entryPoints: ["src/extension.ts"],
        bundle: true,
        format: "cjs",
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: "node",
        outfile: "dist/extension.js",
        external: ["vscode"],
        logLevel: "warning",
        plugins: [
            wasmPlugin,
            /* add to the end of plugins array */
            esbuildProblemMatcherPlugin,
        ],
    });
    if (watch) {
        await ctx.watch();
    } else {
        await ctx.rebuild();
        await ctx.dispose();
    }
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
    name: "esbuild-problem-matcher",

    setup(build) {
        build.onStart(() => {
            if (watch) {
                console.log("[watch] build started");
            }
        });
        build.onEnd((result) => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                if (location == null) return;
                console.error(`    ${location.file}:${location.line}:${location.column}:`);
            });
            if (watch) {
                console.log("[watch] build finished");
            }
        });
    },
};

/**
 * @type {import('esbuild').Plugin}
 *
 * https://esbuild.github.io/plugins/#webassembly-plugin
 */
const wasmPlugin = {
    name: "wasm",

    setup(build) {
        build.onResolve({ filter: /\.wasm$/ }, (args) => ({
            // FIXME: hack
            path: path.join("node_modules", args.path),
            namespace: "wasm-binary",
        }));

        build.onLoad({ filter: /.*/, namespace: "wasm-binary" }, async (args) => ({
            contents: await fs.promises.readFile(args.path),
            loader: "binary",
        }));
    },
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
