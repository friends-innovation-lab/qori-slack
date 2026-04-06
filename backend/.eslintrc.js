module.exports = {
  env: {
    es6: true,
    node: true,
  },
  extends: ["airbnb-base"],
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
  },
  settings: {
    "import/resolver": {
      "babel-module": {},
    },
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
  },
  rules: {
    "max-len": "off",
    "no-eval": "off",
    "quotes": "off",
    "linebreak-style": "off",
    "no-unused-vars": "off",
    "no-console": "off",
    "object-curly-newline": "off",
    "no-trailing-spaces": "off",
    "comma-dangle": "off",
    "operator-linebreak": "off",
  },
};
