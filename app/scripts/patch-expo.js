const fs = require('fs');
const path = require('path');

const target = path.resolve(
  __dirname,
  '../node_modules/@expo/cli/build/src/start/server/metro/externals.js'
);

if (fs.existsSync(target)) {
  let content = fs.readFileSync(target, 'utf8');
  let changed = false;

  if (!content.includes("!x.includes(':')")) {
    content = content.replace(
      ".filter((x)=>!/^_|^(internal|v8|node-inspect)\\/|\\//.test(x)",
      ".filter((x)=>!/^_|^(internal|v8|node-inspect)\\/|\\//.test(x) && !x.includes(':')"
    );
    changed = true;
  }

  if (!content.includes("if (moduleId.includes(':')) continue;")) {
    content = content.replace(
      "for (const moduleId of NODE_STDLIB_MODULES){",
      "for (const moduleId of NODE_STDLIB_MODULES){\n        if (moduleId.includes(':')) continue;"
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(target, content, 'utf8');
    console.log('[patch-expo] Applied Windows Node 22+ compatibility patch to @expo/cli');
  }
}
