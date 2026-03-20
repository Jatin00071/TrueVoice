const { pathToRegexp } = require('path-to-regexp');
const tests=['*','/*','/:path*','/:path(.*)','/(.*)'];
for (const t of tests) {
  try {
    pathToRegexp(t);
    console.log('OK', t);
  } catch (e) {
    console.log('ERR', t, e.message);
  }
}
