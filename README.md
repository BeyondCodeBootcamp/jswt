# [JS with Types](https://jswithtypes.com)

Turn on transpile-free type hinting for your vanilla JS projects #JSWithTypes

1. Create a plain JavaScript project
   ```sh
   npm init
   ```
2. Turn on type linting 💪

   ```sh
   # Create a properly configured `jsconfig.json`
   npx -p jswt@2.x -- jswt init

   # Install @types/node, if needed
   npm install --save '@types/node'
   ```

3. Profit!

Works with **VS Code** out-of-the-box, and
[Vim + ale](https://webinstall.dev/vim-essentials).

## CommonJS vs ESM

Use v1 for CommonJS, or v2 for ESM.

## Watch the Presentation!

[![JS with Types conference title slide](https://jswithtypes.com/assets/utahjs-conf-2022-jswt-title-yt.png)](https://jswithtypes.com/)

<https://jswithtypes.com>

## Layout

Your project will look something like this:

```txt
.
├── bin/
├── jsconfig.json
├── node_modules/
│   └── @types/
│       └── node/
├── package-lock.json
├── package.json
├── README.md
├── types.js
└── typings/
    └── overrides/
        └── index.d.ts
```

## Inner Workings

1. Runs `tsc --init` with these options:
   ```sh
   npx -p typescript@5.x -- \
       tsc --init \
       --allowJs --alwaysStrict --checkJs \
       --module nextnode --moduleResolution nextnode \
       --noEmit --noImplicitAny --target es2024 \
       --typeRoots './typings,./node_modules/@types'
   ```
2. Adds the following keys:
   ```txt
   "paths": { "foo": ["./foo.js"], "foo/*": ["./*"] },
   "include": ["*.js", "bin/**/*.js", "lib/**/*.js", "src/**/*.js"]`,
   "exclude": ["node_modules"]
   ```
3. Renames `tsconfig.json` to `jsconfig.json` \
   (and creates some placeholder files and dirs)

## Bonus: `npm run lint`

You may wish to add common script commands for `fmt` and `lint`:

```sh
npm pkg set scripts.lint="npx -p typescript@5.x -- tsc -p ./jsconfig.json"
npm pkg set scripts.fmt="npx -p prettier@3.x -- prettier -w '**/*.{js,md}'"
```

## Bonus: Vim Config

It should Just Work™, but if your vim setup is a little custom, you may want to
add or modify a line like this:

`~/.vimrc`:

```vim
let g:ale_linters = {
\  'javascript': ['tsserver', 'jshint'],
\  'json': ['fixjson']
\}
```
