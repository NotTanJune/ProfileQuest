#!/usr/bin/env node
import webpack from 'webpack';
import config from '../webpack.config.js';

const modeArg = process.argv[2];
const resolvedMode = (modeArg === 'development' || modeArg === 'production')
  ? modeArg
  : (process.env.NODE_ENV || 'production');

function applyMode(cfg) {
  if (Array.isArray(cfg)) {
    return cfg.map((entry) => applyMode(entry));
  }
  if (typeof cfg === 'function') {
    return applyMode(cfg(resolvedMode));
  }
  return { ...cfg, mode: cfg.mode || resolvedMode };
}

const normalizedConfig = applyMode(config);
const compiler = webpack(normalizedConfig);

compiler.run((err, stats) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  if (stats?.hasErrors()) {
    console.error(stats.toString({ colors: true, modules: false }));
    process.exit(1);
  }
  console.log(stats?.toString({ colors: true, modules: false, children: false }) ?? 'Build complete');
  compiler.close((closeErr) => {
    if (closeErr) {
      console.error(closeErr);
      process.exit(1);
    }
    process.exit(0);
  });
});
