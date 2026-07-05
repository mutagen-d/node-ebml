const path = require('path')
const { merge } = require('webpack-merge')
const webpack = require('webpack')
const TerserPlugin = require('terser-webpack-plugin')

const library = 'EBML'
const base = {
  entry: {
    ebml: './src/index.js',
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
  },
  mode: 'production',
  optimization: {
    minimize: false,
  },
  devtool: 'source-map',
}

const full = {
  resolve: {
    alias: {
      stream: "stream-browserify",
    },
    fallback: {
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/"),
      "process": require.resolve("process/browser"),
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
  ],
}
const min = {
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({ extractComments: false })],
  },
}
const iife = {
  output: {
    library: {
      name: library,
      type: 'window',
    },
    iife: true,
  },
}
const nodejs = {
  output: {
    library: {
      type: 'commonjs2',
    },
  },
  target: 'node',
}
const umd = {
  output: {
    library: {
      name: library,
      type: 'umd',
    },
    globalObject: 'this',
  },
}

const config = [
  merge(base, full, iife, min, {
    output: {
      filename: '[name].iife.min.js',
    },
  }),
  merge(base, full, iife, {
    output: {
      filename: '[name].iife.js',
    },
  }),
  merge(base, full, umd, min, {
    output: {
      filename: '[name].umd.min.js',
    },
  }),
  merge(base, full, umd, {
    output: {
      filename: '[name].umd.js',
    },
  }),
]


module.exports = [
  ...config,
]