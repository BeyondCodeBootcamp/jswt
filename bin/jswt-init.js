#!/usr/bin/env node

//import Dotenv from "dotenv";
//Dotenv.config({ path: ".env" });
//Dotenv.config({ path: ".env.secret" });

const PKG_NAME = "package.json";
const TSC_NAME = "tsconfig.json";
const JSC_NAME = "jsconfig.json";

import Fs from "node:fs/promises";
import Path from "node:path";
import ChildProcess from "node:child_process";

let modulePath = import.meta.url.slice("file://".length);
let moduleDir = Path.dirname(modulePath);

async function main() {
  /* jshint maxcomplexity: 25 */
  /* jshint maxstatements: 300 */
  let flags = {};
  flags.noFiles = process.argv.includes("--no-files");
  flags.noJshint = process.argv.includes("--no-jshint");
  flags.noPrettier = process.argv.includes("--no-prettier");

  let typesAreGlobal =
    process.argv.includes("-g") || process.argv.includes("--global");

  let pkg = await readPackageJson();
  let pkgName = pkg.name;
  if (pkgName.includes("/")) {
    let index = 1;
    index += pkgName.lastIndexOf("/");
    pkgName = pkgName.slice(index);
  }

  // await Fs.mkdir("./docs", { recursive: true });
  // let fh = await Fs.open("./docs/.gitkeep", "a");
  // await fh.close();

  await Fs.mkdir("./typings", { recursive: true });
  let fh = await Fs.open("./typings/.gitkeep", "a");
  await fh.close();

  if (!flags.noPrettier) {
    let prettierFile = await whichPrettier(".", pkg);
    if (!prettierFile) {
      await initFile(
        "./.prettierrc.json",
        [
          `{`,
          `  "printWidth": 80,`,
          `  "tabWidth": 2,`,
          `  "singleQuote": false,`,
          `  "bracketSpacing": true,`,
          `  "proseWrap": "always",`,
          `  "semi": true,`,
          `  "trailingComma": "all"`,
          `}`,
          ``,
        ].join("\n"),
      );
    }

    await initFile(
      "./.prettierignore",
      ["docs", "node_modules", "package.json", "package-lock.json", ""].join(
        "\n",
      ),
    );
  }

  let prefix = ".";
  let libExists = await fileExists("./lib/");
  if (libExists) {
    prefix = "./lib";

    await initFile(
      "./index.js",
      [
        "// auto-generated by `jswt reexport`",
        "// DO NOT EDIT",
        "",
        `import ${pkgName} from "${prefix}/${pkgName}.js";`,
        "",
        `export default ${pkgName};`,
        "",
      ].join("\n"),
    );
  }

  let jsconfig = await readJsConfig();
  if (!jsconfig) {
    let tsconfigTxt = await createTsConfig();
    jsconfig = await createJsConfig(
      pkg,
      tsconfigTxt,
      `${prefix}/${pkgName}.js`,
    );
  }

  let eslintFile = await whichEslint(".", pkg);
  let initJshint = !flags.noJshint && !eslintFile;
  if (initJshint) {
    await initFile(
      "./.jshintrc",
      [
        `{`,
        `  "globals": {`,
        `    "crypto": true`,
        `  },`,
        `  "module": true,`,
        `  "browser": true,`,
        `  "node": true,`,
        `  "esversion": 11,`,
        `  "curly": true,`,
        `  "sub": true,`,
        ``,
        `  "bitwise": true,`,
        `  "eqeqeq": true,`,
        `  "forin": true,`,
        `  "freeze": true,`,
        `  "immed": true,`,
        `  "latedef": "nofunc",`,
        `  "nonbsp": true,`,
        `  "nonew": true,`,
        `  "plusplus": true,`,
        `  "undef": true,`,
        `  "unused": "vars",`,
        `  "maxdepth": 4,`,
        `  "maxstatements": 100,`,
        `  "maxcomplexity": 20`,
        `}`,
        ``,
      ].join("\n"),
    );

    let jshintNpx = "npx -p jshint@2.x -- jshint -c ./.jshintrc ";
    let jshintPaths = ["./*.js"];
    if (prefix !== ".") {
      jshintPaths.push(prefix);
    }
    jshintNpx += jshintPaths.join(" ");
    void (await upsertNpmScript("lint", "jshint", jshintNpx));
  }

  {
    let testRunnerScript = "node ./tests/";
    let script = await upsertNpmScript(
      "test",
      "test",
      testRunnerScript,
      "test",
      '"echo \\"Error: no test specified\\" && exit 1"',
    );
    let hasTestRunnerScript = script.includes(testRunnerScript);
    if (hasTestRunnerScript) {
      await Fs.mkdir("./tests", { recursive: true });
      let testRunnerPath = Path.join(moduleDir, "../tests/index.js");
      let testRunnerText = await Fs.readFile(testRunnerPath, "utf8");
      await initFile("./tests/index.js", testRunnerText);
    }
  }

  let hasWorkflows = await filesExist(`./.github/workflows`);
  if (!hasWorkflows) {
    let ghRepoRe = /\b(github\.com)[:\/]/;
    let isOnGitHub = ghRepoRe.test(pkg?.repository?.url);
    if (!isOnGitHub) {
      let dotgitLink = await maybeReadFile(`.git`);
      if (!dotgitLink) {
        dotgitLink = `.git`;
      }
      let gitConfig = await maybeReadFile(`${dotgitLink}/config`);
      if (gitConfig) {
        isOnGitHub = ghRepoRe.test(gitConfig);
      }
    }
    if (isOnGitHub) {
      let ghaDir = `.github/workflows`;
      let ghaFile = `.github/workflows/node.js.yml`;
      await Fs.mkdir(`./${ghaDir}`, { recursive: true });
      let ghActionPath = Path.join(moduleDir, `../${ghaFile}`);
      let ghActionText = await Fs.readFile(ghActionPath, "utf8");
      await initFile(`./${ghaFile}`, ghActionText);
    }
  }

  // await initFile(
  //   "./jsdoc.conf.json",
  //   JSON.stringify(
  //     {
  //       tags: {
  //         allowUnknownTags: true,
  //       },
  //       source: {
  //         // include all files ending in '.js' or '.jsx'
  //         includePattern: ".+\\.js(x)?$",
  //         // exclude all files beginning with 'node_modules' or '_'
  //         excludePattern: "(^|\\/|\\\\)(node_modules|_)",
  //       },
  //       plugins: [],
  //       templates: {
  //         cleverLinks: false,
  //         monospaceLinks: false,
  //         default: {
  //           outputSourceFiles: true,
  //         },
  //       },
  //     },
  //     null,
  //     2,
  //   ),
  // );

  let indexNames = ["index.js", "./index.js"];
  let mainIsIndex = indexNames.includes(pkg.main);
  let mainPath = `${prefix}/${pkgName}.js`;
  if (!mainIsIndex) {
    // ensures that filepath has leading './'
    mainPath = Path.relative(".", pkg.main);
    mainPath = `./${mainPath}`;
  }

  {
    let mainName = toTitleCase(pkgName);
    await initFile(
      mainPath,
      [
        `let ${mainName} = {};`,
        "",
        `${mainName}.answer = 42;`,
        "",
        `export default ${mainName};`,
        "",
      ].join("\n"),
    );
  }

  let hasIndex = await fileExists("./index.js");
  if (!hasIndex) {
    if (mainIsIndex) {
      let allArgs = ["pkg", "set", `main=${mainPath}`];
      await exec("npm", allArgs);
      await sortAndWritePackageJson();
    }
  }

  if (typesAreGlobal) {
    await initFile(
      "./types.js",
      [
        "// auto-generated by `jswt reexport`",
        "// DO NOT EDIT",
        "",
        "// global types (DO NOT include in `package.json.files`)",
        "",
      ].join("\n"),
    );
  }

  // void (await upsertNpmScript(
  //   "doc",
  //   "jsdoc",
  //   `npx jsdoc@3.x --configure ./jsdoc.conf.json --destination ./docs --package ./package.json --readme ./README.md --access all --private --recurse ${prefix}/`,
  // ));

  if (!flags.noPrettier) {
    void (await upsertNpmScript(
      "fmt",
      "prettier",
      "npx -p prettier@3.x -- prettier -w '**/*.{js,md}'",
    ));
  }

  void (await upsertNpmScript(
    "bump",
    "bump",
    'npm version -m "chore(release): bump to v%s"',
  ));

  if (!flags.noFiles) {
    let result = await exec("npm", ["pkg", "get", "files"]);
    let curScript = result.stdout.trim();
    if ("{}" === curScript) {
      let allArgs = [
        "pkg",
        "set",
        `files[]=${mainPath}`,
        `files[]=./bin/*.js`,
        `files[]=./lib/*.js`,
        `files[]=./tests/*.js`,
      ];
      await exec("npm", allArgs);
      await sortAndWritePackageJson();
    }
  }

  void (await upsertNpmScript(
    "lint",
    "tsc",
    "! npx -p typescript@5.x -- tsc -p ./jsconfig.json | grep '\\.js(\\d\\+,\\d\\+): error' | grep -v '\\<node_modules/'",
  ));

  void (await upsertNpmScript(
    "prepublish",
    "reexport-types",
    "npx -p jswt@2.x -- reexport",
    "reexport",
  ));

  {
    let result = await exec("npm", ["pkg", "get", "exports"]);
    let curScript = result.stdout.trim();
    if ("{}" === curScript) {
      let allArgs = [
        "pkg",
        "set",
        "type=module",
        `exports[.]=${mainPath}`,
        `exports[./*]=./*`,
      ];
      await exec("npm", allArgs);
      await sortAndWritePackageJson();
    }
  }

  {
    let result = await exec("npm", ["pkg", "get", "imports"]);
    let curScript = result.stdout.trim();
    if ("{}" === curScript) {
      let allArgs = [
        "pkg",
        "set",
        "type=module",
        `imports[${pkg.name}]=${mainPath}`,
      ];
      await exec("npm", allArgs);
      await sortAndWritePackageJson();

      await initFile(
        "./importmap.html",
        [
          `<script type="importmap">`,
          `  {`,
          `    "imports": {`,
          `      "${pkg.name}": "${mainPath}",`,
          `      "${pkg.name}/": "./"`,
          `    }`,
          `  }`,
          `</script>`,
          "",
        ].join("\n"),
      );
    }
  }

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

/**
 * @param {String} kebab
 */
function toTitleCase(kebab) {
  let title = kebab.replace(/(^\w|[\W_]\w)/g, function (match) {
    return match.replace(/[\W_]/, "").toUpperCase();
  });
  return title;
}

/**
 * @typedef PkgConfig
 * @prop {Object} eslintConfig
 * @prop {Object} prettier
 */

/**
 * @param {String} path
 * @param {PkgConfig} pkg
 */
async function whichEslint(path, pkg) {
  // https://eslint.org/docs/latest/use/configure/configuration-files
  let eslintFiles = [
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.yaml",
    ".eslintrc.yml",
    ".eslintrc.json",
  ];
  for (let eslintFile of eslintFiles) {
    let exists = await fileExists(Path.join(path, eslintFile));
    if (exists) {
      return eslintFile;
    }
  }

  if (pkg.eslintConfig) {
    return "package.json";
  }

  return null;
}

/**
 * @param {String} path
 * @param {PkgConfig} pkg
 */
async function whichPrettier(path, pkg) {
  // https://prettier.io/docs/en/configuration.html
  if (pkg.prettier) {
    return "package.json";
  }

  let prettierFiles = [
    ".prettierrc",
    ".prettierrc.json",
    ".prettierrc.yml",
    ".prettierrc.yaml",
    ".prettierrc.json5",
    ".prettierrc.js",
    ".prettierrc.config.js",
    ".prettierrc.mjs",
    ".prettierrc.config.mjs",
    ".prettierrc.cjs",
    ".prettierrc.config.cjs",
    ".prettierrc.toml",
  ];
  for (let prettierFile of prettierFiles) {
    let exists = await fileExists(Path.join(path, prettierFile));
    if (exists) {
      return prettierFile;
    }
  }

  return null;
}

/**
 * @param {String} path
 */
async function fileExists(path) {
  let exists = await Fs.access(path)
    .then(function () {
      return true;
    })
    .catch(function (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
      return false;
    });

  return exists;
}

/**
 * @param {String} path
 */
async function filesExist(path) {
  let exists = await Fs.readdir(path)
    .then(function (nodes) {
      return nodes.length > 0;
    })
    .catch(function (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
      return false;
    });

  return exists;
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
 * @param {String} fileName
 */
async function maybeReadFile(fileName) {
  let txt = await Fs.readFile(fileName, "utf8").catch(function (err) {
    return null;
  });
  return txt;
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
      "typescript@5.x",
      "--",
      "tsc",
      "--init",
      "--allowJs",
      "--alwaysStrict",
      "--checkJs",
      "--module",
      "nodenext",
      "--moduleResolution",
      "nodenext",
      "--noEmit",
      "--noImplicitAny",
      "--target",
      version || "es2022", // can't be 'esnext' due to some resolution issues
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
  let args = [
    "-p",
    "typescript@5.x",
    "--",
    "tsc",
    "--init",
    "--target",
    "20xx",
  ];
  return await exec("npx", args).catch(function (err) {
    let version;
    let re = /\bes\d{4}\b/g;
    for (;;) {
      let m = re.exec(`${err.message} ${err.detail}`);
      if (!m) {
        return version;
      }
      version = m[0];
      //console.log("DEBUG version", version);
    }
    return version;
  });
}

/**
 * @param {Object} pkg
 * @param {String} pkg.name
 * @param {String} tsconfigTxt
 * @param {String} mainPath
 * @returns
 */
async function createJsConfig(pkg, tsconfigTxt, mainPath) {
  if (!tsconfigTxt.includes(`"include":`)) {
    let includables = [
      "*.js",
      "bin/**/*.js",
      "lib/**/*.js",
      "src/**/*.js",
      "tests/**/*.js",
    ];
    let includablesStr = JSON.stringify(includables, null, 2);
    includablesStr = includablesStr.replace(/^/gm, "  ");
    includablesStr = includablesStr.trim();

    let includeLine = `,\n  "include": ${includablesStr}`;
    tsconfigTxt = tsconfigTxt.replace(/\n}[\s\n]*$/m, `${includeLine}\n}`);
  }

  {
    let lines = [
      `      "${pkg.name}": ["${mainPath}"]`,
      `      "${pkg.name}/*": ["./*"]`,
    ];
    let str = lines.join(`,\n`);
    tsconfigTxt = tsconfigTxt.replace(
      `// "paths": {},`,
      `"paths": {\n${str}\n    },             `,
    );
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
 * @param {String} fileName - ex: .prettierignore
 * @param {String} initValue - the contents of the file
 */
async function initFile(fileName, initValue) {
  let txt = await Fs.readFile(fileName, "utf8").catch(function (err) {
    if ("ENOENT" === err.code) {
      return "";
    }
    throw err;
  });

  txt = txt.trim();
  if (txt) {
    return;
  }

  await Fs.writeFile(fileName, initValue, "utf8");
}

async function sortAndWritePackageJson() {
  let pkg = await readPackageJson();

  /** @type {Object.<String, any>} */
  let newPkg = {};
  let pkgKeys = Object.keys(pkg);

  let orderedKeys = [
    "name",
    "version",
    "description",
    "main",
    "files",
    "bin",
    "type",
    "imports",
    "exports",
    "scripts",
  ];
  for (let key of orderedKeys) {
    let hasKey = remove(pkgKeys, key);
    if (hasKey) {
      newPkg[key] = pkg[key];
    }
  }
  for (let key of pkgKeys) {
    newPkg[key] = pkg[key];
  }

  let pkgJson = JSON.stringify(newPkg, null, 2);
  await Fs.writeFile(PKG_NAME, pkgJson, "utf8");
}

/**
 * @param {Array<String>} arr
 * @param {String} str
 * @returns {String?}
 */
function remove(arr, str) {
  let index = arr.indexOf(str);
  if (index > -1) {
    let removed = arr.splice(index, 1);
    let el = removed[0] || null;
    return el;
  }

  return null;
}

/**
 * @param {String} metaKey - ex: lint, fmt, start
 * @param {String} scriptKey - ex: jshint, prettier
 * @param {String} scriptValue - the script
 * @param {String} [substr] - don't update the script if this substring is found
 * @param {String} [emptyVal] - treat this the same as an empty string
 * @returns {Promise<String>} - the current or updated script value
 */
async function upsertNpmScript(
  metaKey,
  scriptKey,
  scriptValue,
  substr,
  emptyVal,
) {
  let newScript = "";
  {
    let result = await exec("npm", ["pkg", "get", `scripts.${scriptKey}`]);
    let curScript = result.stdout.trim();
    if ("{}" === curScript || emptyVal === curScript) {
      newScript = scriptValue;
      let allArgs = ["pkg", "set", `scripts.${scriptKey}=${scriptValue}`];
      await exec("npm", allArgs);
    }
  }

  if (metaKey === scriptKey) {
    return newScript;
  }

  let metaScript = `npm run ${scriptKey}`;
  let result = await exec("npm", ["pkg", "get", `scripts.${metaKey}`]);
  let curMetaScript = result.stdout.trim();
  if ("{}" === curMetaScript) {
    let allArgs = ["pkg", "set", `scripts.${metaKey}=${metaScript}`];
    await exec("npm", allArgs);
    return metaScript;
  }

  if (!substr) {
    substr = scriptKey;
  }
  if (curMetaScript.includes(substr)) {
    return curMetaScript;
  }

  let curScriptVal = JSON.parse(curMetaScript);
  newScript = `${curScriptVal} && ${metaScript}`;
  let allArgs = ["pkg", "set", `scripts.${metaKey}=${newScript}`];
  await exec("npm", allArgs);
  return newScript;
}

/**
 * @param {String} exe
 * @param {Array<String>} args
 */
async function exec(exe, args) {
  return await new Promise(function (resolve, reject) {
    let cmd = ChildProcess.spawn(exe, args);

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
