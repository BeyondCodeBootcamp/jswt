#!/usr/bin/env node

//import Dotenv from "dotenv";
//Dotenv.config({ path: ".env" });
//Dotenv.config({ path: ".env.secret" });

import Fs from "node:fs/promises";
import Path from "node:path";
import Walk from "./_walk.js";

let LOADABLE = [".js", ".cjs", ".mjs"];

// TODO make configurable
let IGNORABLE = [
  "index.js",
  "types.js",
  "build",
  "dist",
  "node_modules",
  "tmp",
];
let IGNORABLE_PATTERNS = /\.min\./;
let IGNORABLE_TYPES = [".bak", ".git", ".tmp"];

/**
 * @typedef Typedef
 * @prop {String} name - the name of the export
 * @prop {String} path - the importable path
 */

async function main() {
  let typesAreGlobal =
    process.argv.includes("-g") || process.argv.includes("--global");

  let indexIsMain = true;
  let pkgName = "";
  {
    let pkgTxt = await Fs.readFile("./package.json", "utf8");
    let pkg = JSON.parse(pkgTxt);
    pkgName = pkg.name;
    if (pkgName.includes("/")) {
      let index = 1;
      index += pkgName.lastIndexOf("/");
      pkgName = pkgName.slice(index);
    }

    let indexNames = ["index.js", "./index.js"];
    indexIsMain = indexNames.includes(pkg.main);
  }

  let indexLines;
  if (typesAreGlobal) {
    let typeLines = await walkTypeDefs();
    await writeTypesJs(typeLines);
    console.info(`Wrote GLOBAL exports to './types.js'`);

    indexLines = [" * N/A - see global exports in 'types.js'"];
  } else {
    await removeIfGenerated("./types.js").catch(ignoreNoExist);
  }

  if (indexIsMain) {
    await writeIndexJs(pkgName, indexLines);
  } else {
    await removeIfGenerated("./index.js").catch(ignoreNoExist);
  }
}

/**
 * @param {any} err
 */
function ignoreNoExist(err) {
  if (err.code === "ENOENT") {
    return false;
  }
  throw err;
}

/**
 * @param {Array<String>} typeLines
 */
async function writeTypesJs(typeLines) {
  let lines = [
    "// auto-generated by `jswt reexport`",
    "// DO NOT EDIT",
    "",
    "// global types (DO NOT include in `package.json.files`)",
    "",
    "/**",
  ].concat(typeLines, [" */", ""]);

  await Fs.writeFile("./types.js", lines.join("\n"), "utf8");
}

/**
 * @param {String} pkgName
 * @param {Array<String>?} [indexLines]
 */
async function writeIndexJs(pkgName, indexLines) {
  if (!indexLines) {
    indexLines = await walkTypeDefs();
  }
  let prefix = await Fs.access("./lib/")
    .then(function () {
      return "./lib";
    })
    .catch(function (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
      return ".";
    });

  let mainName = toTitleCase(pkgName);
  let lines = [
    "// auto-generated by `jswt reexport`",
    "// DO NOT EDIT",
    "",
    `import ${mainName} from "${prefix}/${pkgName}.js";`,
    "",
    "// these typedef reexports will be available to dependent packages",
    "/**",
  ];
  lines = lines.concat(indexLines, [
    " */",
    "",
    `export default ${mainName};`,
    "",
  ]);

  await Fs.readFile("./index.js", "utf8")
    .then(function (txt) {
      if (!txt.includes("generated by `jswt")) {
        /** @type {import('./jswt-init.js').MyError} */
        //@ts-ignore
        let err = new Error();
        err.problem = `'./index.js' exists and was not generated by 'jswt reexport'.`;
        err.solution = [`git mv index.js '${prefix}/${pkgName}.js'`];
        throw err;
      }
    })
    .catch(function (err) {
      if ("ENOENT" === err.code) {
        return;
      }
      throw err;
    });
  await Fs.writeFile("./index.js", lines.join("\n"), "utf8");
  console.info(`Wrote './index.js' (exports '${prefix}/${pkgName}.js')`);
}

/**
 * @param {String} kebab
 */
function toTitleCase(kebab) {
  let title = kebab.replace(/(^\w|[\W_]\w)/g, function (match) {
    return match.replace(/[\W_]/, "").toUpperCase();
  });
  return title;
}

async function walkTypeDefs() {
  /** @type Array<Typedef> */
  let typedefs = [];

  // TODO match package.json.files
  await Walk.walk(".", async function (err, pathname, dirent) {
    if (err) {
      // TODO check error
      console.error("unexpected walk error:");
      console.error(err);
      return false;
    }
    if (!dirent) {
      return false;
    }

    let read = await shouldRead(err, pathname, dirent);
    if (!read) {
      return read;
    }

    let js = await Fs.readFile(pathname, "utf8");
    let lines = js.split("\n");

    let _typedefs = lines
      .filter(function (line) {
        // \x20 for space so that this match doesn't find its own file
        return line.includes("* @typedef\x20") && !line.includes("{import(");
      })
      .map(function (line) {
        let parts = line.trim().replace(/\s+/g, " ").split(" ");
        let name = parts.pop();
        if ("*/" === name) {
          name = parts.pop();
        }

        return {
          path: `./${pathname}`,
          name: name,
        };
      });
    //@ts-ignore - apparently `concat()` is `any` rather than `T`
    typedefs = typedefs.concat(_typedefs);
  });

  let defLines = typedefs.map(function (t) {
    return ` * @typedef {import('${t.path}').${t.name}} ${t.name}`;
  });
  return defLines;
}

/**
 * @param {String} filepath
 */
async function removeIfGenerated(filepath) {
  let autogenRe = /auto-generated by `jswt reexport`/;

  let text = await Fs.readFile(filepath, "utf8");
  let isGenerated = autogenRe.test(text);
  if (!isGenerated) {
    console.warn(`[warn] skipping 'rm ${filepath}': not generated by 'jswt'`);
    return;
  }

  await Fs.unlink(filepath);
}

/** @type {import('./_walk.js').WalkFunc} */
async function shouldRead(err, pathname, dirent) {
  if (!dirent) {
    return false;
  }

  if (IGNORABLE.includes(dirent.name)) {
    return false;
  }

  if (IGNORABLE_PATTERNS.test(dirent.name)) {
    return false;
  }

  let ext = Path.extname(dirent.name);
  if (IGNORABLE_TYPES.includes(ext)) {
    return false;
  }

  // skip child directories that have their own package.json (such as git submodules)
  const isChildDir = "." !== pathname && dirent.isDirectory();
  if (isChildDir) {
    const submodulePkg = Path.join(pathname, "package.json");
    const isNormalDir = await Fs.access(submodulePkg).catch(Boolean);
    if (!isNormalDir) {
      return false;
    }
  }

  if (!dirent.isFile()) {
    return;
  }

  if (!LOADABLE.includes(Path.extname(dirent.name))) {
    //console.warn("# warn: skipping non-js file '%s'", filename);
    return;
  }

  return true;
}

main()
  .then(function () {
    process.exit(0);
  })
  .catch(function (err) {
    console.error(``);
    console.error(`Error:`);

    if (err.problem) {
      console.error(`    ${err.problem}`);
      console.error(`    ${err.stack}`);
      console.error(``);
      console.error(`Possible fix:`);

      let fix = err.solution.join(`\n    `);
      console.error(`    ${fix}`);
      throw err;
    }

    console.error(`${err.code}: ${err.message}`);
    console.error(err.stack);
  })
  .catch(function () {
    console.error(``);
    process.exit(1);
  });
