const js = require('@eslint/js');

module.exports = [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 'latest',
        },
        rules: {
            'arrow-spacing': ['warn', { before: true, after: true }],
            'comma-spacing': 'error',
            'comma-style': 'error',
            curly: ['error', 'multi-line', 'consistent'],
            'dot-location': ['error', 'property'],
            'handle-callback-err': 'off',
            'keyword-spacing': 'error',
            'max-nested-callbacks': ['error', { max: 4 }],
            'max-statements-per-line': ['error', { max: 2 }],
            'no-console': 'off',
            'no-empty-function': 'error',
            'no-floating-decimal': 'error',
            'no-lonely-if': 'error',
            'no-multi-spaces': 'error',
            'no-shadow': ['error', { allow: ['err', 'resolve', 'reject'] }],
            'no-trailing-spaces': ['error'],
            'no-var': 'error',
            'no-undef': 'off',
            'prefer-const': 'error',
            quotes: ['error', 'single'],
            'space-before-blocks': 'error',
            'space-before-function-paren': ['error', {
                anonymous: 'never',
                named: 'never',
                asyncArrow: 'always',
            }],
            'space-infix-ops': 'error',
            'space-unary-ops': 'error',
            yoda: 'error',
        },
    },
]