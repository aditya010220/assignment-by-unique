const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Prevent Node 24 on Windows from exhausting memory when spawning multiple jest-worker forks
config.maxWorkers = 1;

module.exports = config;
