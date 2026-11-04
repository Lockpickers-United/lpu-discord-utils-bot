module.exports = {
    env: {
        es2021: true,
        node: true
    },
    extends: [
        'eslint:recommended'
    ],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
    },
    rules: {
        'no-unused-vars': ['warn', {
            ignoreRestSiblings: true,
            args: 'all',
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^(React|_)',
            destructuredArrayIgnorePattern: '^_',
            caughtErrors: 'all',
            caughtErrorsIgnorePattern: '^_',
        }],
    }
}
