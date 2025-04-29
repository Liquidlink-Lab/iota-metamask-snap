module.exports = {
  root: true,
  extends: ['@metamask/eslint-config'],
  overrides: [
    {
      files: ['**/*.ts'],
      extends: [
        '@metamask/eslint-config-typescript',
        '@metamask/eslint-config-nodejs',
      ],
    },
    {
      files: ['**/*.test.ts', '**/*.test.js'],
      extends: ['@metamask/eslint-config-jest'],
    },
  ],
  ignorePatterns: [
    '!.prettierrc.js',
    '**/!.eslintrc.js',
    '**/dist*/',
    '**/*__GENERATED__*',
    '**/build',
    '**/public',
    '**/.cache',
  ],
};
