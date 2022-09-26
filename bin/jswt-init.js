#!/usr/bin/env node
"use strict";

//require("dotenv").config({ path: ".env" });
//require("dotenv").config({ path: ".env.secret" });

const PKG_NAME = "package.json";
const TSC_NAME = "tsconfig.json";
const JSC_NAME = "jsconfig.json";

var Fs = require("node:fs").promises;
var spawn = require("node:child_process").spawn;

async function main() {
  let pkg = await readPackageJson();

  let jsconfig = await readJsConfig();
  if (!jsconfig) {
    let tsconfigTxt = await createTsConfig();
    jsconfig = await createJsConfig(pkg, tsconfigTxt);
  }

  let fh = await Fs.open("./types.js", "a");
  await fh.close();

  await Fs.mkdir("./typings", { recursive: true });
  fh = await Fs.open("./typings/.gitkeep", "a");
  await fh.close();

  await upsertNpmScript(
    "lint",
    "tsc",
    "npx -p typescript@4.x -- tsc -p ./jsconfig.json",
  );

  await upsertNpmScript(
    "fmt",
    "prettier",
    "npx -p prettier@2.x -- prettier -w '**/*.{js,md}'",
  );

  await upsertNpmScript(
    "prepublish",
    "reexport",
    "npx -p jswt@1.x -- reexport",
  );

  let jsconfigTxt = JSON.stringify(jsconfig, null, 2);
  // for stderr / debug output
  console.error(`./jsconfig.json:`);
  console.info(jsconfigTxt);
  console.error(``);
  console.error(`How to manually run the linter:`);
  console.error(`   tsc -p ./jsconfig.json`);
  console.error(``);
  console.error(`How to configure vim:`);
  console.error(`    curl https://webi.sh/vim-essentials | sh`);
  console.error(``);
  console.error(`    " Update ~/.vimrc if the automatic settings didn't work`);
  console.error(`    let g:ale_linters = {
    \\  'javascript': ['tsserver', 'jshint'],
    \\  'json': ['fixjson']
    \\}`);
  console.error(``);
  console.error(`How to configure VS Code:`);
  console.error(`    N/A: VS Code natively understands jsconfig.json`);
  console.error(``);

  // TODO what was I going to read from package.json?
  //console.log(pkg);
}

async function readPackageJson() {
  let pkgTxt = await Fs.readFile(PKG_NAME, "utf8").catch(function (err) {
    err.reason = "package.json";
    err.problem = `Couldn't read './${PKG_NAME}'.`;
    err.solution = [`# Create a new ${PKG_NAME}`, `npm init`];
    throw err;
  });

  try {
    return JSON.parse(pkgTxt);
  } catch (e) {
    /** @type {MyError} */
    //@ts-ignore
    let err = e;
    err.reason = "package.parse";
    err.problem = `Couldn't parse './${PKG_NAME}'.`;
    err.solution = [
      `# Fix missing commas and other simple syntax errors`,
      `fixjson -w ./${PKG_NAME}`,
    ];
    throw err;
  }
}

async function readJsConfig() {
  let jscTxt = await Fs.readFile(JSC_NAME, "utf8").catch(ignoreNotFound);
  if (null === jscTxt) {
    return null;
  }

  try {
    return parseJson5(jscTxt);
  } catch (e) {
    /** @type {MyError} */
    //@ts-ignore
    let err = e;
    err.reason = "jsconfig.parse";
    err.problem = `Couldn't parse './${JSC_NAME}'.`;
    err.solution = [
      `# Fix missing commas and other simple syntax errors`,
      `fixjson -w ./${JSC_NAME}`,
    ];
    throw err;
  }
}

/**
 * @returns {Promise<String>}
 */
async function createTsConfig() {
  let tscTxt = await Fs.readFile(TSC_NAME, "utf8").catch(ignoreNotFound);

  if (!tscTxt) {
    let version = await getLatest20xx();
    let args = [
      "-p",
      "typescript",
      "--",
      "tsc",
      "--init",
      "--allowJs",
      "--alwaysStrict",
      "--checkJs",
      "--moduleResolution",
      "node",
      "--noEmit",
      "--noImplicitAny",
      "--target",
      // can't be 'esnext' due to some resolution issues
      version || "es2022",
      "--typeRoots",
      "./typings,./node_modules/@types",
    ];
    //console.log("npx", args.join(" "));
    await exec("npx", args).catch(function (err) {
      err.reason = `tsc-init`;
      err.problem = `Couldn't run \`tsc --init\` to create './jsconfig.json'`;
      err.solution = [
        `# Install the 'typescript' package and create './tsconfig.json'`,
        `npm install --location=global typescript`,
        `tsc --init`,
      ];
      throw err;
    });
    return await createTsConfig();
  }

  return tscTxt;
}

/**
 * @returns Promise<String>
 */
async function getLatest20xx() {
  // error TS6046: Argument for '--target' option must be:
  // 'es3', ... 'es2022', 'esnext'.
  let args = ["-p", "typescript", "--", "tsc", "--init", "--target", "20xx"];
  return await exec("npx", args).catch(function (err) {
    let version;
    let re = /\bes\d{4}\b/g;
    for (;;) {
      let m = re.exec(`${err.message} ${err.detail}`);
      if (!m) {
        return version;
      }
      version = m[0];
      //console.log("version", version);
    }
    return version;
  });
}

/**
 * @param {Object} pkg
 * @param {String} tsconfigTxt
 * @returns
 */
async function createJsConfig(pkg, tsconfigTxt) {
  if (!tsconfigTxt.includes(`"include":`)) {
    let includables = ["*.js", "bin/**/*.js", "lib/**/*.js", "src/**/*.js"];
    let includablesStr = JSON.stringify(includables, null, 2);
    let includeLine = `,\n  "include": ${includablesStr}`;
    tsconfigTxt = tsconfigTxt.replace(/\n}[\s\n]*$/m, `${includeLine}\n}`);
  }

  if (!tsconfigTxt.includes(`"exclude":`)) {
    let excludeLine = `,\n  "exclude": ["node_modules"]`;
    tsconfigTxt = tsconfigTxt.replace(/\n}[\s\n]*$/m, `${excludeLine}\n}`);
  }

  let tsconfig;
  try {
    tsconfig = parseJson5(tsconfigTxt);
  } catch (e) {
    /** @type {MyError} */
    //@ts-ignore
    let err = e;
    err.reason = "tsconfig.parse";
    err.problem = `Couldn't parse './${TSC_NAME}'.`;
    err.solution = [
      `# Fix missing commas and other simple syntax errors`,
      `fixjson -w ./${TSC_NAME}`,
    ];
    throw err;
  }

  await Fs.writeFile(JSC_NAME, tsconfigTxt, "utf8");
  await Fs.unlink(TSC_NAME);

  return tsconfig;
}

/**
 * @param {String} tsconfigTxt
 * @returns
 * @throws {MyError}
 */
async function parseJson5(tsconfigTxt) {
  let lines = tsconfigTxt.split("\n");
  lines = lines.map(function (line) {
    // `// ...`
    // `/* ... */`
    // `   /* ... */   `
    return line
      .replace(/(^|\s+)\/\*\s+.*\*\/(\s+|,|$)/g, "$2")
      .replace(/\s*\/\/.*/, "");
  });
  let tsconfig = lines.join("\n");

  //console.log("tsconfig");
  //console.log(tsconfig);

  return JSON.parse(tsconfig);
}

/**
 * @param {MyError} err
 * @throw {MyError}
 */
function ignoreNotFound(err) {
  if ("ENOENT" === err.code) {
    return null;
  }
  throw err;
}

/**
 * @param {String} scriptName - ex: lint, fmt, start
 * @param {String} substr - don't update the script if this substring is found
 * @param {String} scriptValue - the script
 */
async function upsertNpmScript(scriptName, substr, scriptValue) {
  let result = await exec("npm", ["pkg", "get", `scripts.${scriptName}`]);
  let curLintValue = result.stdout.trim();

  if ("{}" === curLintValue) {
    let allArgs = ["pkg", "set", `scripts.${scriptName}=${scriptValue}`];
    await exec("npm", allArgs);
    curLintValue = `"${scriptValue}"`;
  }

  if (!curLintValue.includes(substr)) {
    let curLintScript = JSON.parse(curLintValue);
    let allArgs = [
      "pkg",
      "set",
      `scripts.${scriptName}=${curLintScript}; ${scriptValue}`,
    ];
    await exec("npm", allArgs);
  }
}

/**
 * @param {String} exe
 * @param {Array<String>} args
 */
async function exec(exe, args) {
  return new Promise(function (resolve, reject) {
    let cmd = spawn(exe, args);

    /** @type {Array<String>} */
    let stdout = [];
    /** @type {Array<String>} */
    let stderr = [];

    cmd.stdout.on("data", function (data) {
      stdout.push(data.toString("utf8"));
    });

    cmd.stderr.on("data", function (data) {
      stderr.push(data.toString("utf8"));
    });

    cmd.on("close", function (code) {
      let result = {
        code: code,
        stdout: stdout.join(""),
        stderr: stderr.join(""),
      };

      if (!code) {
        resolve(result);
        return;
      }

      /** @type {MyError} */
      //@ts-ignore
      let err = new Error(result.stderr);
      err.code = result.code;
      err.detail = result.stdout;
      reject(err);
    });
  });
}

/**
 * @typedef MyError
 * @prop {String|Number?} code
 * @prop {String} detail
 * @prop {String} message
 * @prop {String} problem
 * @prop {String} reason
 * @prop {Array<String>} solution
 */

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
