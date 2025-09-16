import { join } from 'node:path';
import type { CheckSyntaxOptions } from '@winner-fed/unplugin-check-syntax';
import { CheckSyntax, printErrors } from '@winner-fed/unplugin-check-syntax';
import checkSyntaxRspack from '@winner-fed/unplugin-check-syntax/rspack';
import checkSyntaxVite from '@winner-fed/unplugin-check-syntax/vite';
import checkSyntaxWebpack from '@winner-fed/unplugin-check-syntax/webpack';
import { winPath } from '@winner-fed/utils';
import type { IApi } from '@winner-fed/winjs';

export default (api: IApi) => {
  api.describe({
    key: 'checkSyntax',
    config: {
      schema({ zod }) {
        return zod
          .union([
            zod
              .boolean()
              .describe(
                '是否启用语法检查。设为 true 启用默认配置的语法检查，false 禁用语法检查功能。',
              ),
            zod
              .object({
                targets: zod
                  .array(zod.string())
                  .describe(
                    '目标浏览器兼容性范围配置。使用标准的 browserslist 格式数组，如 ["chrome >= 90", "firefox >= 88", "safari >= 14"]。插件将检查构建产物中的 JavaScript 语法是否与指定的浏览器兼容。如未配置，将使用项目根配置中的 targets 作为默认值。',
                  )
                  .optional(),
                exclude: zod
                  .union([zod.string(), zod.array(zod.string())])
                  .describe(
                    '排除语法检查的文件路径模式。支持单个正则表达式字符串或字符串数组，用于匹配需要跳过检查的源文件路径。例如："/node_modules/" 或 ["/vendor/", "\\.min\\.js$"]。被排除的文件不会进行语法兼容性检查。',
                  )
                  .optional(),
                ecmaVersion: zod
                  .union([
                    zod
                      .string()
                      .regex(
                        /^es(3|5|6|20\d{2}|\d+)$/i,
                        'ECMAScript版本格式无效，支持格式：es3, es5, es6, es2015, es2016, es2017等',
                      ),
                    zod.number().min(3),
                  ])
                  .describe(
                    '允许使用的最低 ECMAScript 语法版本。可以是字符串格式（如 "es5", "es2015", "es2020", "es2023"）或数字格式（如 5, 2015, 2020, 2023）。此配置的优先级高于 targets 配置。用于限制构建产物中可使用的 JavaScript 语法特性，确保代码在目标环境中正常运行。',
                  )
                  .optional(),
              })
              .describe(
                '语法检查详细配置对象。用于自定义目标浏览器、排除文件和ECMAScript版本等检查参数。',
              ),
          ])
          .describe(
            '代码语法兼容性检查插件配置。基于 unplugin-check-syntax，在构建过程中检测 JavaScript/TypeScript 代码是否包含目标浏览器不支持的语法特性，支持 Vite、Webpack 和 Rspack 构建工具，帮助确保应用在指定浏览器环境中的兼容性。插件默认在非开发环境下启用。',
          );
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

  // 增加检测 html 文件类型的功能
  api.onBuildHtmlComplete(
    async (html: { htmlFiles?: Array<{ path: string }> }) => {
      const htmlFiles = html?.htmlFiles || [];
      if (api.env === 'development' || htmlFiles.length === 0) {
        return;
      }

      const targets = api.config.targets;
      const checkerOptions = getCheckSyntaxOptions(targets);
      const checker = new CheckSyntax({
        rootPath: api.paths.absOutputPath,
        ecmaVersion: 2015 as const, // 默认ES2015
        ...checkerOptions,
      });

      // 获取 dist 目录下的所有 html 文件
      // 遍历 html 文件，检测是否存在语法错误
      for (const htmlFile of htmlFiles) {
        const htmlFilePath = winPath(
          join(api.paths.absOutputPath, htmlFile.path),
        );
        await checker.check(htmlFilePath);
      }

      printErrors(
        checker.errors,
        checker.ecmaVersion,
        checker.excludeErrorLogs,
      );
    },
  );
};
