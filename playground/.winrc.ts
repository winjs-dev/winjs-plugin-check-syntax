import { defineConfig } from 'win';

export default defineConfig({
  plugins: ['@winner-fed/plugin-check-syntax'], // 使用相对路径引用本地开发的插件
  targets: { chrome: 60, ie: 11 },
  jsMinifier: 'terser',
  // 测试 checkSyntax 默认值逻辑
  // checkSyntax: true,
  // checkSyntax: {},
  // 也可以测试对象配置
  checkSyntax: {
    ecmaVersion: 5, // 只配置 ecmaVersion，targets 应该使用默认值
  },
  // rsbuild: {},
});
