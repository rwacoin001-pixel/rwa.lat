import { BadRequestException } from '@nestjs/common'
import { parse, toSql } from 'pgsql-ast-parser'

const FUNCTIONS = new Set('count sum avg min max round trunc floor ceil ceiling abs power coalesce nullif greatest least date_trunc date_part extract now current_date timezone to_char lower upper length char_length substring left right concat concat_ws string_agg bool_and bool_or row_number rank dense_rank lag lead first_value last_value'.split(' '))
const TYPES = new Set(['text', 'varchar', 'character varying', 'integer', 'int', 'int2', 'int4', 'int8', 'smallint', 'bigint', 'numeric', 'decimal', 'real', 'float', 'float4', 'float8', 'double precision', 'boolean', 'bool', 'date', 'time', 'timestamp', 'timestamptz', 'interval'])
const NODES = new Set(['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN', 'select', 'with', 'union', 'union all', 'table', 'statement', 'ref', 'call', 'binary', 'unary', 'integer', 'numeric', 'string', 'boolean', 'null', 'constant', 'cast', 'case', 'list', 'array', 'array select', 'extract', 'keyword', 'ternary', 'member'])
const OPERATORS = new Set(['+', '-', '*', '/', '%', '^', '=', '!=', '<>', '>', '<', '>=', '<=', 'AND', 'OR', 'NOT', 'IS NULL', 'IS NOT NULL', 'IS TRUE', 'IS FALSE', 'IS NOT TRUE', 'IS NOT FALSE', 'IS DISTINCT FROM', 'IS NOT DISTINCT FROM', 'IN', 'NOT IN', 'LIKE', 'NOT LIKE', 'ILIKE', 'NOT ILIKE', 'BETWEEN', 'NOT BETWEEN', '||', 'AT TIME ZONE'])

export function validateAiSql(sql: string, views: Set<string>): string {
  const reject = (): never => { throw new BadRequestException({ code: 'AI_SQL_REJECTED', message: '仅支持查询 ai_ro 视图的只读 SELECT / WITH 语句。' }) }
  if (typeof sql !== 'string' || !sql.trim() || sql.length > 20_000) return reject()
  try {
    const statements = parse(sql, { locationTracking: true })
    if (statements.length !== 1 || !['select', 'with', 'union', 'union all'].includes(statements[0].type)) return reject()
    const walk = (value: unknown, ctes: Set<string>): void => {
      if (!value || typeof value !== 'object') return
      if (Array.isArray(value)) { value.forEach(item => walk(item, ctes)); return }
      const node = value as Record<string, any>
      if (node.type && !NODES.has(node.type)) reject()
      if (node.into || node.for || node.forUpdate || node.locking || node.skipLocked) reject()
      // Custom operators and type input functions can execute code even inside SELECT.
      if (node.opSchema && node.opSchema !== 'pg_catalog') reject()
      if (node.type === 'constant') reject()
      // The parser stores integer literals as JS numbers. Require quoted numeric casts for larger values.
      if (node.type === 'integer' && !Number.isSafeInteger(node.value)) reject()
      if (node.type === 'numeric') {
        // The parser also rounds decimal literals through JS Number. Preserve their
        // original digits as a numeric cast before serializing the validated AST.
        const literal = sql.slice(node._location?.start, node._location?.end)
        if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(literal)) reject()
        node.type = 'cast'
        node.operand = { type: 'string', value: literal }
        node.to = { name: 'numeric' }
        delete node.value
      }
      if (node.type === 'with') {
        const scope = new Set(ctes)
        for (const binding of node.bind ?? []) {
          // Non-recursive CTEs can only refer to earlier bindings.
          if (!['select', 'with', 'union', 'union all'].includes(binding.statement?.type)) reject()
          walk(binding.statement, scope)
          scope.add(binding.alias.name)
        }
        walk(node.in, scope)
        return
      }
      if (node.type === 'table') {
        const name = node.name
        if (!name || (name.schema ? name.schema !== 'ai_ro' || !views.has(name.name) : !ctes.has(name.name))) reject()
      }
      if (node.type === 'call') {
        const fn = node.function
        if (!fn || (fn.schema && fn.schema !== 'pg_catalog') || /^(pg_|dblink|lo_|set_config|query_to_xml|database_to_xml|schema_to_xml)/i.test(fn.name) || !FUNCTIONS.has(fn.name)) reject()
      }
      if (node.type === 'cast') {
        const cast = node.to
        if (!cast || (cast.schema && cast.schema !== 'pg_catalog') || !TYPES.has(cast.name)) reject()
      }
      if (node.type === 'keyword' && !['current_date', 'current_timestamp', 'current_time', 'localtimestamp', 'localtime'].includes(node.keyword)) reject()
      if (node.op && !OPERATORS.has(String(node.op).toUpperCase())) reject()
      for (const item of Object.values(node)) walk(item, ctes)
    }
    walk(statements[0], new Set())
    // Serialize the validated AST so comments/trailing semicolons cannot escape the wrapper.
    return toSql.statement(statements[0]).replace(/;\s*$/, '')
  } catch { return reject() }
}

export function aiCsv(columns: string[], rows: unknown[][]): string {
  const cell = (value: unknown) => {
    let text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    // Neutralize spreadsheet formula execution, including control-character prefixes.
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }
  return '\uFEFF' + [columns, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
