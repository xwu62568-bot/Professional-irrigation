const path = require('path');

const runtimeProfile = process.env.MINI_PROGRAM_PROFILE === 'test' ? 'test' : 'local';
const isTestProfile = runtimeProfile === 'test';
const executionServiceUrl = process.env.MINI_EXECUTION_SERVICE_URL
  || (isTestProfile ? 'https://api.ssdsdeeefd.xyz/api/execution' : 'http://127.0.0.1:4310');
const mqttGatewayUrl = process.env.MINI_MQTT_GATEWAY_URL
  || (isTestProfile ? 'https://api.ssdsdeeefd.xyz/api/mqtt' : 'http://127.0.0.1:4320');
const useMockData = process.env.MINI_USE_MOCK_DATA === 'true';
const defaultAuthEmail = '88403120@qq.com';
const defaultAuthPassword = '123456';

const config = {
  projectName: 'irrigation-mini-program',
  date: '2026-05-07',
  designWidth: 375,
  deviceRatio: {
    375: 2,
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  compiler: {
    type: 'webpack5',
  },
  alias: {
    '@': path.resolve(__dirname, '..', 'src'),
    '@irrigation/domain': path.resolve(__dirname, '..', '..', 'packages', 'irrigation-domain', 'src'),
    '@irrigation/api': path.resolve(__dirname, '..', '..', 'packages', 'irrigation-api', 'src'),
  },
  defineConstants: {
    __MINI_PROGRAM_PROFILE__: JSON.stringify(runtimeProfile),
    __MINI_USE_MOCK_DATA__: JSON.stringify(useMockData),
    __MINI_EXECUTION_SERVICE_URL__: JSON.stringify(executionServiceUrl),
    __MINI_MQTT_GATEWAY_URL__: JSON.stringify(mqttGatewayUrl),
    __MINI_AUTH_EMAIL__: JSON.stringify(process.env.MINI_AUTH_EMAIL ?? defaultAuthEmail),
    __MINI_AUTH_PASSWORD__: JSON.stringify(process.env.MINI_AUTH_PASSWORD ?? defaultAuthPassword),
  },
  mini: {
    compile: {
      include: [
        path.resolve(__dirname, '..', '..', 'packages', 'irrigation-domain', 'src'),
        path.resolve(__dirname, '..', '..', 'packages', 'irrigation-api', 'src'),
      ],
    },
    postcss: {
      pxtransform: {
        enable: true,
        config: {},
      },
      url: {
        enable: true,
        config: {
          limit: 1024,
        },
      },
      cssModules: {
        enable: false,
      },
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
  },
};

module.exports = function (merge) {
  const env = process.env.NODE_ENV;
  const base = env === 'development' ? require('./dev') : require('./prod');
  return merge({}, config, base);
};
