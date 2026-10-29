import { BadRequestException } from '@nestjs/common'
import { aiCsv, validateAiSql } from '../src/admin-ai-sql'

const views = new Set(['users', 'quant_lots', 'quant_products', 'deposits', 'withdrawals'])

describe('admin AI SQL boundary', () => {
  it.each([
    'SELECT count(*) FROM ai_ro.users WHERE created_at >= current_date',
    'SELECT sum(principal_atomic) / 1000000 AS principal, count(DISTINCT user_id) AS holders FROM ai_ro.quant_lots WHERE principal_atomic > 0',
    "SELECT date_trunc('day', credited_at), sum(atomic_amount) FROM ai_ro.deposits WHERE state = 'credited' AND credited_at >= now() - interval '7 days' GROUP BY 1",
    'WITH x AS (SELECT * FROM ai_ro.users), y AS (SELECT count(*) n FROM x) SELECT * FROM y',
    'SELECT p.name, sum(l.principal_atomic) FROM ai_ro.quant_lots l JOIN ai_ro.quant_products p ON p.id=l.product_id GROUP BY p.name',
    'SELECT * FROM (SELECT id FROM ai_ro.users) u UNION ALL SELECT id FROM ai_ro.users',
    "SELECT '123456789012345678901234567890'::numeric, 'hello; -- world'::text",
  ])('accepts bounded analytics syntax: %s', sql => {
    expect(validateAiSql(sql, views)).toBeTruthy()
  })

  it.each([
    'SELECT * FROM app.users', 'SELECT * FROM users', 'SELECT * FROM information_schema.columns',
    'SELECT * FROM pg_catalog.pg_authid', 'SELECT * FROM ai_ro.unknown',
    'SELECT 1; SELECT 2', 'DELETE FROM ai_ro.users', 'UPDATE ai_ro.users SET status=1',
    'COPY ai_ro.users TO STDOUT', 'EXPLAIN SELECT * FROM ai_ro.users',
    'SELECT * INTO temp FROM ai_ro.users', 'SELECT * FROM ai_ro.users FOR UPDATE',
    'WITH x AS (DELETE FROM app.users RETURNING *) SELECT * FROM x',
    'WITH x AS (SELECT * FROM ai_ro.users) DELETE FROM app.users',
    'WITH RECURSIVE x AS (SELECT 1 UNION ALL SELECT 1 FROM x) SELECT * FROM x',
    'SELECT (SELECT email FROM app.admin_users) FROM ai_ro.users',
    'SELECT * FROM ai_ro.users WHERE id IN (SELECT id FROM app.users)',
    'SELECT * FROM ai_ro.users UNION SELECT * FROM app.users',
    "SELECT pg_sleep(10)", "SELECT pg_catalog.pg_read_file('/etc/passwd')",
    "SELECT dblink('x','select 1')", "SELECT lo_import('/etc/passwd')",
    "SELECT set_config('search_path','app',false)", "SELECT query_to_xml('select * from app.users',false,false,'')",
    'SELECT app.count(*) FROM ai_ro.users', 'SELECT ai_ro.count(*) FROM ai_ro.users',
    "SELECT 'x'::app.unsafe", "SELECT 'x'::regclass", "SELECT app.unsafe 'x'",
    'SELECT 1 OPERATOR(app.+) 2', 'SELECT current_user', 'SELECT 9007199254740993',
    'WITH x AS (SELECT * FROM x) SELECT * FROM x',
  ])('rejects unsafe or unsupported SQL: %s', sql => {
    expect(() => validateAiSql(sql, views)).toThrow(BadRequestException)
  })

  it('serializes a single AST so comments cannot swallow the outer limit', () => {
    const sql = validateAiSql('SELECT * FROM ai_ro.users; -- trailing comment', views)
    expect(sql).not.toMatch(/;|--/)
  })

  it.each(['0.123456789012345678901', '9007199254740993.0', '-0.000000000000000000001'])('preserves exact decimal literal digits: %s', literal => {
    const sql = validateAiSql(`SELECT ${literal} AS amount`, views)
    expect(sql).toContain(literal.replace(/^-/, ''))
    expect(sql).toContain('numeric')
    expect(sql).not.toContain('9007199254740992')
  })

  it('rejects missing and oversized SQL', () => {
    expect(() => validateAiSql('', views)).toThrow()
    expect(() => validateAiSql(' '.repeat(20001), views)).toThrow()
  })

  it('escapes CSV and neutralizes spreadsheet formulas in headers and cells', () => {
    expect(aiCsv(['=header', 'amount'], [[' a,"b"\n', '12345678901234567890.001'], ['\t=SUM(1)', null], ['-1', '@cmd']]))
      .toBe('\uFEFF"\'=header","amount"\r\n" a,""b""\n","12345678901234567890.001"\r\n"\'\t=SUM(1)",""\r\n"\'-1","\'@cmd"\r\n')
  })
})
