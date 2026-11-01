The project uses native Node.js ES modules (`"type": "module"`). Use a supported
Node.js LTS release. Dependencies were not upgraded as part of this migration.

- `npm start` runs the bot; `npm run dev` runs it with nodemon.
- `npm run deploy` publishes slash commands to Discord.
- Commands and events export their handler object as the default export.
- Relative imports include the `.js` extension.

The `keys/` directory is ignored by Git. Its local JavaScript files have been
converted, but existing copies on other machines must also use ESM before
starting or deploying the bot. In `keys.js`, `reddit-keys.js`, and `botConfig.js`,
replace `module.exports = { ... }` with `export { ... }` when the object lists
existing variables. For inline values, use named declarations such as
`export const token = 'your local value'`. `users.js` already uses ESM. Keep all
credentials out of version control.

The `/reload` command imports a fresh copy of the selected command using a unique
URL. Its dependencies remain cached. Restart the bot to reload shared utilities
or to release modules retained by repeated reloads.

Migration validation included source syntax checks, importing all 30 non-entry
modules, serializing all 8 command payloads, and startup/deployment dry runs with
Discord login and REST requests stubbed. No live login or deployment was performed.
The existing lint errors in `modmailReply.js`, `processBeltMessage.js`, and the
ignored `src/obsolete/testRequest.js` remain.
