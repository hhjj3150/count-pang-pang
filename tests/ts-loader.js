// lib/game/*.ts 파일을 테스트에서 바로 불러오기 위한 작은 도구 (TypeScript → JavaScript로 바꿔서 실행)
const fs = require('fs')
const path = require('path')
const ts = require(path.join(__dirname, '..', 'node_modules', 'typescript'))
const ROOT = path.join(__dirname, '..')
for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = (m, file) => {
    let src = fs.readFileSync(file, 'utf8')
    src = src.replace(/from "@\/([^"]+)"/g, (_, p) => `from "${path.join(ROOT, p).replace(/\\/g, '/')}"`)
    const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
    m._compile(out.outputText, file)
  }
}
module.exports = { ROOT }
