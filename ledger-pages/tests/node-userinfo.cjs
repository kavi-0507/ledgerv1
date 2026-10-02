// Some restricted Windows shells deny os.userInfo(), which tsx uses for its temp path.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const os = require('node:os');
try { os.userInfo(); }
catch { os.userInfo = () => ({ username: 'ledger-test', uid: -1, gid: -1, shell: null, homedir: os.tmpdir() }); }
