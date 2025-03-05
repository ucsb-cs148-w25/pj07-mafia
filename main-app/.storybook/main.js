const path = require("path");

module.exports = {
  framework: {
    name: '@storybook/react-webpack5',
    options: {}
  },
  stories: ["../src/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/preset-create-react-app"
  ],
  webpackFinal: async (config) => {
    // Add alias to override the socket module in Storybook
    config.resolve.alias = {
      ...config.resolve.alias,
      "../service/socket": path.resolve(__dirname, "../src/mocks/mockSocket.js"),
    };
    return config;
  },
};