# [JS with Types](https://jswithtypes.com)

Turn on transpile-free type hinting for your vanilla JS projects #JSWithTypes

1. Create a plain JavaScript project
   ```sh
   npm init
   ```
2. Turn on type linting πͺ
   ```sh
   # Create a properly configured `jsconfig.json`
   npx jswt init
   ```
3. Profit!

Works with **VS Code** out-of-the-box, and
[Vim + ale](https://webinstall.dev/vim-essentials).

## Watch the Presentation!

[![JS with Types conference title slide](https://jswithtypes.com/assets/utahjs-conf-2022-jswt-title-yt.png)](https://jswithtypes.com/)

<https://jswithtypes.com>

## Layout

Your project will look something like this:

```txt
.
βββ bin/
βββ jsconfig.json
βββ node_modules/
β   βββ @types/
β       βββ node/
βββ package-lock.json
βββ package.json
βββ README.md
βββ types.js
βββ typings/
    βββ overrides/
        βββ index.d.ts
```

## Inner Workings

1. Runs `tsc --init` with these options:
   ```sh
   npx -p typescript@4 -- \
       tsc --init \
       --allowJs --alwaysStrict --checkJs \
       --moduleResolution node \
       --noEmit --noImplicitAny --target es2022 \
       --typeRoots './typings,./node_modules/@types'
   ```
2. Adds the following keys:
   ```txt
   "include": ["*.js", "bin/**/*.js", "lib/**/*.js", "src/**/*.js"]`
   "exclude": ["node_modules"]
   ```
3. Renames `tsconfig.json` to `jsconfig.json` \
   (and creates some placeholder files and dirs)

## Bonus: `npm run lint`

You may wish to add common script commands for `fmt` and `lint`:

```sh
npm pkg set scripts.lint="npx -p typescript@4 -- tsc -p ./jsconfig.json"
npm pkg set scripts.fmt="npx -p prettier@2 -- prettier -w '**/*.{js,md}'"
```

## Bonus: Vim Config

It should Just Workβ’, but if your vim setup is a little custom, you may want to
add or modify a line like this:

`~/.vimrc`:

```vim
let g:ale_linters = {
\  'javascript': ['tsserver', 'jshint'],
\  'json': ['fixjson']
\}
```
