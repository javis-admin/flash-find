const path = require("path");

module.exports = {
  entry: "./src/index.js", // Adjust this to the correct entry point of your application
  mode: "production",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
    publicPath: '/',
    library: {
      name: 'FlashFind',
      type: "umd",
      export: "default",
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
      // {
      //   test: /\.worker\.js$/,
      //   use: {
      //     loader: "worker-loader",
      //     options: { inline: "fallback" },
      //   },
      // },
    ],
  },
  resolve: {
    extensions: [".js"],
  },
};
