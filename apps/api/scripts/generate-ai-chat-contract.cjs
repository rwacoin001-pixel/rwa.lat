// Generate just the AI response contract without overwriting the shared API schema.
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { pathToFileURL } = require('node:url')
const ts = require('typescript')
require('reflect-metadata')
const swaggerDist = path.dirname(require.resolve('@nestjs/swagger'))
const { SchemaObjectFactory } = require(path.join(swaggerDist, 'services/schema-object-factory.js'))
const { ModelPropertiesAccessor } = require(path.join(swaggerDist, 'services/model-properties-accessor.js'))
const { SwaggerTypesMapper } = require(path.join(swaggerDist, 'services/swagger-types-mapper.js'))

async function main() {
  const filename = path.resolve(__dirname, '../src/ai/dto/ai-chat-response.dto.ts')
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, experimentalDecorators: true } }).outputText
  const loaded = new Module(filename)
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  loaded._compile(compiled, filename)
  const schemas = {}
  new SchemaObjectFactory(new ModelPropertiesAccessor(), new SwaggerTypesMapper()).exploreModelSchema(loaded.exports.AiChatResponseDto, schemas)
  const document = { openapi: '3.0.3', info: { title: 'AI chat response', version: '1' }, paths: { '/v1/ai/chat': { post: { operationId: 'AiController_chat', responses: { 200: { description: 'Reply and clarification cards', content: { 'application/json': { schema: { $ref: '#/components/schemas/AiChatResponseDto' } } } } } } } }, components: { schemas } }
  const { default: openapiTS, astToString } = await import(pathToFileURL(path.resolve(__dirname, '../../../node_modules/openapi-typescript/dist/index.mjs')).href)
  fs.writeFileSync(path.resolve(__dirname, '../../../lib/api/ai-chat-schema.d.ts'), astToString(await openapiTS(document)))
  console.log('Generated AI response types from server DTOs')
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
