import path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export default {
  entry: './src/index.jsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].js',
    clean: true,
    publicPath: '/',
  },
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
  devServer: {
    historyApiFallback: true,
    port: 3000,
    hot: true,
    proxy: [
      {
        context: ['/api'],
        target: 'https://profilequest-3feeae1dd6a1.herokuapp.com',
        changeOrigin: true,
        secure: false
      }
    ]
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: 'defaults' }],
              ['@babel/preset-react', { runtime: 'automatic' }]
            ],
            plugins: [
              '@babel/plugin-syntax-dynamic-import'
            ]
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  plugins: [
    new HtmlWebpackPlugin({ template: 'public/index.html' }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public', to: '.', filter: (p) => !p.endsWith('index.html') }
      ]
    }),
    new webpack.DefinePlugin({
      'process.env.VITE_API_BASE_URL': JSON.stringify(process.env.VITE_API_BASE_URL || 'https://profilequest-3feeae1dd6a1.herokuapp.com')
    })
  ]
};


