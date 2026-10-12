const path = require('path');
const dotenv = require('dotenv');

// Attempt loading from workspace root or current dir
const possiblePaths = [
  process.env.ENV_FILE,
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), '.env'),
].filter(Boolean);

for (const envPath of possiblePaths) {
  dotenv.config({ path: envPath });
}

const requiredEnvVars = ['VERIFY_TOKEN', 'APP_SECRET', 'PAGE_ACCESS_TOKEN'];

function validateEnv() {
  const missing = [];
  for (const key of requiredEnvVars) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }

  return {
    PORT: parseInt(process.env.PORT || '3000', 10),
    VERIFY_TOKEN: process.env.VERIFY_TOKEN,
    APP_SECRET: process.env.APP_SECRET,
    PAGE_ACCESS_TOKEN: process.env.PAGE_ACCESS_TOKEN,
  };
}

const env = {
  get PORT() {
    return parseInt(process.env.PORT || '3000', 10);
  },
  get VERIFY_TOKEN() {
    return process.env.VERIFY_TOKEN;
  },
  get APP_SECRET() {
    return process.env.APP_SECRET;
  },
  get PAGE_ACCESS_TOKEN() {
    return process.env.PAGE_ACCESS_TOKEN;
  },
  validateEnv,
};

module.exports = env;
