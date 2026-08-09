// Vercel entry point: treats the whole Express app as one serverless
// function (see vercel.json's rewrite). Local dev/VPS-style hosting still
// goes through src/server.js's app.listen() — this file is Vercel-only.
module.exports = require('../src/app');
