import cjs from '@rollup/plugin-commonjs';
import node from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';


export default {
  input: 'js/customDataType/contentLoader.js',
  output: [
    { file: 'contentLoaderBundle.js', format: 'iife', name: 'ContentLoader' }
  ],
  plugins: [
    node({ browser: true }),
    cjs(),
    terser()
  ],
};
