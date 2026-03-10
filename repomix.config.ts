import { defineConfig } from 'repomix';

export default defineConfig({
  output: {
    filePath: 'output.json',
    style: 'json',
    removeComments: true,
  },
  ignore: {
    useGitignore: true,
    useDotIgnore: true,
    useDefaultPatterns: true,
    customPatterns: ['**/node_modules/**', '**/dist/**', '**/output.xml'],
  },
});