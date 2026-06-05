const path = require('path')
const { merge } = require('webpack-merge')
const webpack = require('webpack')
const TerserPlugin = require('terser-webpack-plugin')

const baseConfig = {
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

const browserPolyfills = {
  resolve: {
    alias: {
      // This is often more reliable than fallback
      stream: "stream-browserify",
      // buffer: "buffer/",
      // process: "process/browser"
    },
    fallback: {
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/"),
      // It's common to polyfill other modules like 'crypto', 'http', etc.
      // "crypto": require.resolve("crypto-browserify"),
      // "http": require.resolve("stream-http"),
    }
  },
  plugins: [
    // The ProvidePlugin makes a module available as a variable in every module.
    // This creates a global 'Buffer' variable that points to the 'Buffer' export from the 'buffer' package.
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      // It's also common to provide a global 'process' object if other polyfills need it.
      // process: 'process/browser',
    }),
  ],
}

const createConfig = (minimize = false, env = 'web') => {
  const optimization = minimize ? {
    minimize,
    minimizer: [new TerserPlugin({ extractComments: false })],
  } : { minimize }
  const opts = env === 'web' ? {
    optimization,
    output: {
      library: 'EBML',
      libraryTarget: 'window',
      filename: minimize ? '[name].min.js' : '[name].js',
    },
    ...browserPolyfills,
  } : {
    optimization,
    output: {
      filename: minimize ? '[name].min.node.js' : '[name].node.js',
    }
  }
  return merge(baseConfig, opts)
}

module.exports = [
  createConfig(false),
  createConfig(true),
  createConfig(false, 'node'),
  createConfig(true, 'node'),
]