module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: ['standard'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // Customize rules
    semi: ['error', 'always'],
    'space-before-function-paren': ['error', {
      anonymous: 'always',
      named: 'never',
      asyncArrow: 'always'
    }],
    'no-unused-vars': ['warn', {
      vars: 'all',
      args: 'after-used',
      ignoreRestSiblings: true
    }],
    'no-console': 'off', // Since this is a backend service, console.log is acceptable
    'comma-dangle': ['error', 'never'],
    'quote-props': ['error', 'as-needed'],
    'object-curly-spacing': ['error', 'always']
  }
};
