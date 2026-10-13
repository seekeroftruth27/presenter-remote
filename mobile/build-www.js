// Builds www/ (what Capacitor packages into the app) from ../web, the same page
// the browser proxy serves. In the app, pp.js calls ProPresenter directly.
const fs = require("fs");
const path = require("path");

const web = path.join(__dirname, "..", "web");
const www = path.join(__dirname, "www");
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });
for (const f of fs.readdirSync(web)) fs.copyFileSync(path.join(web, f), path.join(www, f));
fs.copyFileSync(path.join(__dirname, "..", "VERSION"), path.join(www, "VERSION"));   // shown on the page
console.log("www/ built from web/");
