import type { CheckSyntaxOptions } from '@winner-fed/unplugin-check-syntax';
import checkSyntaxRspack from '@winner-fed/unplugin-check-syntax/rspack';
import checkSyntaxVite from '@winner-fed/unplugin-check-syntax/vite';
import checkSyntaxWebpack from '@winner-fed/unplugin-check-syntax/webpack';
import type { IApi } from '@winner-fed/winjs';

export type CheckSyntax = boolean | CheckSyntaxOptions;

export default (api: IApi) => {
  api.describe({
    key: 'checkSyntax',
    config: {
      schema({ zod }) {
        return zod.union([
          zod.boolean(),
          zod.object({
            /**
             * The target browser range of the project.
             * Its value is a standard browserslist array.
             */
            targets: zod.array(zod.string()).optional(),
            /**
             * Used to exclude a portion of source files during detection.
             * You can pass in one or more regular expressions to match the paths of source files.
             */
            exclude: zod
              .union([zod.string(), zod.array(zod.string())])
              .optional(),
            /**
             * The minimum ECMAScript syntax version that can be used in the build artifact.
             * The priority of `ecmaVersion` is higher than `targets`.
             */
            ecmaVersion: zod.union([zod.string(), zod.number()]).optional(),
          }),
        ]);
      },
    },
    enableBy: () => {
      return api.env !== 'development';
    },
  });

  // 显示禁止检查
  if (
    api.userConfig.checkSyntax === false ||
    api.userConfig.checkSyntax === undefined
  ) {
    return;
  }

  // 将字符串格式的正则表达式转换为 RegExp 对象
  const convertRegexStrings = (
    value: string | string[] | undefined,
  ): RegExp | RegExp[] | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') {
      return new RegExp(value);
    }
    return value.map((str) => new RegExp(str));
  };

  function getCheckSyntaxOptions(targets: IApi[]): CheckSyntaxOptions {
    const { userConfig } = api;
    const { checkSyntax = {} } = userConfig;
    // targets 转换为 Browserslist 格式
    // 如 { chrome: 90} => ['chrome 90']
    const browserTargets = Object.entries(targets).map(
      ([name, version]) => `${name} ${version}`,
    );
    // 处理配置：如果是布尔值则转为空对象，否则使用原配置
    const checkSyntaxConfig =
      typeof checkSyntax === 'boolean' ? {} : checkSyntax;

    // 如果没有明确配置 targets，则使用 userConfig.targets 作为默认值
    const finalTargets = checkSyntaxConfig.targets || browserTargets;

    return {
      ...checkSyntaxConfig,
      targets: finalTargets,
      exclude: convertRegexStrings(checkSyntaxConfig.exclude),
    };
  }

  // Vite 配置
  api.modifyViteConfig((config) => {
    const targets = api.config.targets;
    config.plugins = config.plugins || [];
    config.plugins.push(
      checkSyntaxVite({
        ...getCheckSyntaxOptions(targets),
      }),
    );

    return config;
  });

  // Webpack 配置
  api.modifyWebpackConfig((memo) => {
    const targets = api.config.targets;
    memo.plugins = memo.plugins || [];
    memo.plugins.push(
      checkSyntaxWebpack({
        ...getCheckSyntaxOptions(targets),
      }) as unknown as NonNullable<typeof memo.plugins>[0], // 使用更具体的类型断言
    );

    return memo;
  });

  // Rspack 配置
  api.modifyRspackConfig((config, { appendPlugins }) => {
    const targets = api.config.targets;
    appendPlugins([
      checkSyntaxRspack({
        ...getCheckSyntaxOptions(targets),
      }),
    ]);
    return config;
  });
};
