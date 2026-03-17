import cjs from '@rollup/plugin-commonjs';
import node from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';


export default {
  input: 'js/core/core.js',
  output: [
    { file: 'coreBundle.js', format: 'iife', name: 'Core' }
  ],
  plugins: [
    node({ browser: true }),
    cjs(),
    terser()
  ],
};
