const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Firebase compatibility fixes for Metro
config.resolver.sourceExts.push('mjs');

module.exports = config;
