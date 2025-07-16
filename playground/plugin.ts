import type { IApi } from 'win';

export default (api: IApi) => {
  api.modifyHTML(($) => {
    return $;
  });

  api.addHTMLHeadScripts(
    () => `
  // 可选链和空值合并 (ES2020)
    const config = {
      theme: 'dark'
    };
    const selectedTheme = config?.theme ?? 'light';
    `,
  );
};
