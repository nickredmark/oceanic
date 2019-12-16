module.exports = {
  webpack: (config, isServer) => {
    if (config.name == "client") {
      config.node = {
        ...config.node,
        fs: "empty"
      };
    }
    return config;
  }
};
