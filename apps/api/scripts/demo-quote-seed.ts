/*
 * demo-quote-seed.ts — 本地演示报价脚本（demo 来源，每份 1000 USDT）
 * ---------------------------------------------------------------------------
 * 只为以下三项本地演示「投资」产品写入当前有效的 demo 报价：
 *   H100 Inference Pool  (external_ref: h100-inference-pool, class: compute)
 *   Solar Income 2027    (external_ref: solar-income-2027,   class: rwa)
 *   Tech Growth ETF      (external_ref: tech-growth-etf,     class: stocks)
 *
 * 预测类产品（asset_class_id='prediction'，如 Fed Rate Cut Q3 2026）绝不写入——
 * 解析目标时带硬校验（PREDICTION_PRODUCT_REFUSED），计划里也只允许 3 条目标。
 *
 * 用法（在 apps/api 目录下运行）：
 *   npx ts-node scripts/demo-quote-seed.ts           # 默认 dry-run：只读 + 打印计划
 *   npx ts-node scripts/demo-quote-seed.ts --apply   # 显式写入（见下方安全前置）
 *
 * 安全前置（写入必须同时满足，任一不满足即非零退出、零写入；全部在任何
 * INSERT 之前完成——写事务只包裹插入本身）：
 *   1) 显式传入 --apply（默认 dry-run 永不写库、不打开写事务）
 *   2) NODE_ENV 与 APP_ENV 经 trim().toLowerCase() 归一后均不等于 'production'
 *   3) 当前连接的数据库名（current_database() 实查）明确等于 rwa_lat_dev
 *
 * 写入并发与原子性（仅 --apply 路径）：
 *   BEGIN → pg_advisory_xact_lock(固定脚本锁) → 全量计划校验后的插入 → COMMIT，
 *   任一步失败 ROLLBACK（不会留下部分写入）；固定 advisory 锁保证同脚本并发
 *   串行执行，配合幂等检查不会重复插入。
 *
 * 幂等：同一产品只有当已存在报价同时满足
 *   同来源 + 同价格原子值 + 同精度 + 同币种 + asset_code 与产品一致
 *   + captured_at <= now + valid_until > now
 *   才视为有效重复并跳过（status=unchanged）；未来采集时间或错资产码的报价
 *   不算有效重复。反复执行不会无限插入同一报价；报价过期后重跑只补 1 条
 *   （valid_until = now + 7 天）。
 *
 * 输出只包含产品 ID/名称/状态/价格等非秘密信息；失败时只输出已知
 * DemoQuoteError 的 code 与信息或通用 database error，不回显连接串、认证、
 * SQL 等原始细节。失败一律以退出码 1 结束。
 *
 * 数值口径（全部取自代码，未猜测）：
 *   - price_quotes.unit_price_atomic_amount = numeric(78,0) 原子表示
 *     （src/catalog/price.entity.ts）；unit_price_decimals smallint 默认 6
 *     （迁移 1790000000009 按 6 位小数回填全部既有报价）。
 *   - 报价币种 = src/financial/amounts.ts 的 SETTLEMENT_ASSET_CODE（'USDT'），
 *     结算精度 = SETTLEMENT_ASSET_DECIMALS（6）；下单/估值均按 USD|USDT 1:1 接受
 *     （isUsdUsdtEquivalent：orders.service.ts、portfolio.service.ts）。
 *   - quote.asset_code 必须等于 product.asset_code：catalog.service.ts
 *     getLatestQuote 与 portfolio.service.ts 取价 join 都按 asset_code 匹配。
 *   - 因此 1000 USDT/份 → unit_price_atomic_amount = 1000 × 10^6 = 1000000000，
 *     unit_price_decimals = 6（与 products.asset_decimals=6 量纲不同：前者是
 *     「价格」刻度，后者是「持仓数量」刻度，见 financial/amounts.ts 的
 *     calculateProductQuantityAtomic 换算公式）。
 */
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import {
  SETTLEMENT_ASSET_CODE,
  SETTLEMENT_ASSET_DECIMALS,
} from '../src/financial/amounts'

export const REQUIRED_DATABASE_NAME = 'rwa_lat_dev'
export const DEMO_QUOTE_SOURCE = 'demo'
export const DEMO_QUOTE_CURRENCY = SETTLEMENT_ASSET_CODE // 'USDT'
/** 报价价格刻度：价格原子表示的小数位（结算币种精度 = 6）。 */
export const QUOTE_PRICE_DECIMALS = SETTLEMENT_ASSET_DECIMALS // 6
export const DEMO_UNIT_PRICE_TEXT = '1000'
export const QUOTE_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000
export const PREDICTION_ASSET_CLASS_ID = 'prediction'
/** 同脚本并发互斥的固定 advisory 锁键（bigint）。 */
export const DEMO_QUOTE_LOCK_KEY = '8511020260926'

export interface DemoQuoteTarget {
  externalRef: string
  displayName: string
  assetClassId: string
}

export const TARGET_PRODUCTS: readonly DemoQuoteTarget[] = [
  { externalRef: 'h100-inference-pool', displayName: 'H100 Inference Pool', assetClassId: 'compute' },
  { externalRef: 'solar-income-2027', displayName: 'Solar Income 2027', assetClassId: 'rwa' },
  { externalRef: 'tech-growth-etf', displayName: 'Tech Growth ETF', assetClassId: 'stocks' },
]

export interface DemoQuoteProductRow {
  id: string
  externalRef: string | null
  displayName: string
  assetClassId: string
  assetCode: string
  assetDecimals: number
  state: string
}

export interface DemoQuoteExistingQuoteRow {
  productId: string
  assetCode: string
  unitPriceAtomicAmount: string
  unitPriceDecimals: number
  currency: string
  source: string
  validUntil: Date | string
  capturedAt: Date | string
}

export interface DemoQuoteInsertRow {
  id: string
  productId: string
  assetCode: string
  unitPriceAtomicAmount: string
  unitPriceDecimals: number
  currency: string
  source: string
  validUntil: Date
  capturedAt: Date
}

export interface DemoQuoteStore {
  currentDatabaseName(): Promise<string>
  listProducts(): Promise<DemoQuoteProductRow[]>
  listQuotes(productIds: readonly string[]): Promise<DemoQuoteExistingQuoteRow[]>
  insertQuote(row: DemoQuoteInsertRow): Promise<void>
  /** 仅 --apply 路径调用：实现方须包 BEGIN + advisory 锁 + COMMIT/ROLLBACK。 */
  runInWriteTransaction<T>(work: () => Promise<T>): Promise<T>
}

export type DemoQuoteStatus = 'planned' | 'inserted' | 'unchanged'

export interface DemoQuotePlanItem {
  productId: string
  externalRef: string
  displayName: string
  assetClassId: string
  status: DemoQuoteStatus
  quoteAssetCode: string
  unitPriceAtomicAmount: string
  unitPriceDecimals: number
  currency: string
  source: string
  validUntil: string
}

export interface DemoQuoteRunResult {
  mode: 'dry-run' | 'apply'
  databaseName: string
  pricePerUnit: string
  items: DemoQuotePlanItem[]
  insertedCount: number
  unchangedCount: number
}

export class DemoQuoteError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'DemoQuoteError'
  }
}

/** 金额 → 原子表示：只接受纯十进制文本，超出刻度直接拒绝（不四舍五入）。 */
export function toAtomicAmountExact(decimalText: string, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 30) {
    throw new DemoQuoteError('INVALID_DECIMALS', `Quote decimals ${decimals} must be an integer within 0..30.`)
  }
  const match = /^([0-9]+)(?:\.([0-9]+))?$/.exec(decimalText)
  if (!match) {
    throw new DemoQuoteError('INVALID_AMOUNT', `Amount "${decimalText}" is not a plain decimal number.`)
  }
  const fraction = match[2] ?? ''
  if (fraction.length > decimals) {
    throw new DemoQuoteError(
      'AMOUNT_PRECISION_EXCEEDED',
      `Amount "${decimalText}" does not fit ${decimals} decimal places.`,
    )
  }
  return BigInt(match[1] + fraction.padEnd(decimals, '0')).toString()
}

function normalizeAtomic(text: string): string {
  const match = /^-?[0-9]+$/.exec(text.trim())
  if (!match) {
    throw new DemoQuoteError('INVALID_ATOMIC_AMOUNT', `Atomic amount "${text}" is not an integer string.`)
  }
  return BigInt(text.trim()).toString()
}

function normalizeEnvFlag(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export function parseArgs(argv: readonly string[]): { apply: boolean } {
  let apply = false
  for (const arg of argv) {
    if (arg === '--apply') {
      apply = true
      continue
    }
    throw new DemoQuoteError('UNSUPPORTED_ARGUMENT', `Unsupported argument: ${arg}`)
  }
  return { apply }
}

/**
 * 写入安全前置：dry-run 一律放行（只读）；写入必须显式 --apply、非生产环境
 * （环境串 trim + 小写归一，'PRODUCTION ' 之类也被拒绝）、且当前数据库明确为
 * rwa_lat_dev。本函数在任何 INSERT 之前调用。
 */
export function assertWritePreconditions(input: {
  apply: boolean
  nodeEnv?: string | undefined
  appEnv?: string | undefined
  databaseName: string
}): void {
  if (!input.apply) return
  const nodeEnv = normalizeEnvFlag(input.nodeEnv)
  const appEnv = normalizeEnvFlag(input.appEnv)
  if (nodeEnv === 'production' || appEnv === 'production') {
    throw new DemoQuoteError(
      'PRODUCTION_REFUSED',
      'demo-quote-seed refuses to write when NODE_ENV or APP_ENV is production.',
    )
  }
  if (input.databaseName !== REQUIRED_DATABASE_NAME) {
    throw new DemoQuoteError(
      'DATABASE_REFUSED',
      `demo-quote-seed only writes to ${REQUIRED_DATABASE_NAME}; current database is "${input.databaseName}".`,
    )
  }
}

/**
 * 计算三项演示产品的报价计划。只解析 TARGET_PRODUCTS 里的 external_ref；
 * 解析到的产品必须与预期 class/名称一致，且绝不能是 prediction 类——任一不符即抛错。
 */
export function planDemoQuotes(input: {
  products: readonly DemoQuoteProductRow[]
  quotes: readonly DemoQuoteExistingQuoteRow[]
  now: Date
}): DemoQuotePlanItem[] {
  const unitPriceAtomicAmount = toAtomicAmountExact(DEMO_UNIT_PRICE_TEXT, QUOTE_PRICE_DECIMALS)
  const items: DemoQuotePlanItem[] = []

  for (const target of TARGET_PRODUCTS) {
    const matches = input.products.filter((product) => product.externalRef === target.externalRef)
    if (matches.length !== 1) {
      throw new DemoQuoteError(
        'TARGET_PRODUCT_MISSING',
        `Expected exactly one product with external_ref "${target.externalRef}"; found ${matches.length}.`,
      )
    }
    const product = matches[0]
    if (product.assetClassId === PREDICTION_ASSET_CLASS_ID) {
      throw new DemoQuoteError(
        'PREDICTION_PRODUCT_REFUSED',
        `Product "${target.externalRef}" is a prediction product; demo quotes must never touch prediction products.`,
      )
    }
    if (product.assetClassId !== target.assetClassId) {
      throw new DemoQuoteError(
        'TARGET_PRODUCT_MISMATCH',
        `Product "${target.externalRef}" has asset_class_id "${product.assetClassId}", expected "${target.assetClassId}".`,
      )
    }
    if (product.displayName.trim() !== target.displayName) {
      throw new DemoQuoteError(
        'TARGET_PRODUCT_MISMATCH',
        `Product "${target.externalRef}" is named "${product.displayName}", expected "${target.displayName}".`,
      )
    }
    if (product.state !== 'published') {
      throw new DemoQuoteError(
        'TARGET_PRODUCT_NOT_PUBLISHED',
        `Product "${target.externalRef}" is in state "${product.state}"; demo quotes require published products.`,
      )
    }
    if (!product.assetCode) {
      throw new DemoQuoteError('TARGET_PRODUCT_INVALID', `Product "${target.externalRef}" has no asset_code.`)
    }
    if (!Number.isInteger(product.assetDecimals) || product.assetDecimals < 0 || product.assetDecimals > 30) {
      throw new DemoQuoteError(
        'TARGET_PRODUCT_INVALID',
        `Product "${target.externalRef}" asset_decimals ${product.assetDecimals} must be an integer within 0..30.`,
      )
    }

    // 有效重复 = 同来源/同价格原子值/同精度/同币种 + asset_code 与产品一致
    // + captured_at 不在未来 + valid_until 仍在未来。
    const hasActiveDuplicate = input.quotes.some((quote) => {
      if (quote.productId !== product.id) return false
      if (quote.source !== DEMO_QUOTE_SOURCE) return false
      if (quote.unitPriceDecimals !== QUOTE_PRICE_DECIMALS) return false
      if (quote.currency !== DEMO_QUOTE_CURRENCY) return false
      if (quote.assetCode !== product.assetCode) return false
      if (normalizeAtomic(quote.unitPriceAtomicAmount) !== unitPriceAtomicAmount) return false
      if (new Date(quote.capturedAt).getTime() > input.now.getTime()) return false
      return new Date(quote.validUntil).getTime() > input.now.getTime()
    })

    items.push({
      productId: product.id,
      externalRef: target.externalRef,
      displayName: product.displayName,
      assetClassId: product.assetClassId,
      status: hasActiveDuplicate ? 'unchanged' : 'planned',
      // quote.asset_code 必须等于 product.asset_code（取价 join 按 asset_code 匹配）
      quoteAssetCode: product.assetCode,
      unitPriceAtomicAmount,
      unitPriceDecimals: QUOTE_PRICE_DECIMALS,
      currency: DEMO_QUOTE_CURRENCY,
      source: DEMO_QUOTE_SOURCE,
      validUntil: new Date(input.now.getTime() + QUOTE_VALIDITY_MS).toISOString(),
    })
  }

  if (items.length !== TARGET_PRODUCTS.length) {
    throw new DemoQuoteError('TARGET_SCOPE_VIOLATION', `Demo quote plan must cover exactly ${TARGET_PRODUCTS.length} products.`)
  }
  if (items.some((item) => item.assetClassId === PREDICTION_ASSET_CLASS_ID)) {
    throw new DemoQuoteError('PREDICTION_PRODUCT_REFUSED', 'Demo quote plan must never include prediction products.')
  }
  return items
}

export async function runDemoQuoteSeed(options: {
  argv: readonly string[]
  env: { NODE_ENV?: string | undefined; APP_ENV?: string | undefined }
  store: DemoQuoteStore
  now?: Date
}): Promise<DemoQuoteRunResult> {
  const { apply } = parseArgs(options.argv)
  const now = options.now ?? new Date()
  const databaseName = await options.store.currentDatabaseName()
  // 全部前置检查（参数/环境/库名）在任何 INSERT 之前完成。
  assertWritePreconditions({
    apply,
    nodeEnv: options.env.NODE_ENV,
    appEnv: options.env.APP_ENV,
    databaseName,
  })

  const buildPlan = async () => {
    const products = await options.store.listProducts()
    const candidateIds = products
      .filter((product) => TARGET_PRODUCTS.some((target) => target.externalRef === product.externalRef))
      .map((product) => product.id)
    const quotes = await options.store.listQuotes(candidateIds)
    // 计划期完成产品/数值/幂等全部校验；校验失败时零写入。
    return planDemoQuotes({ products, quotes, now })
  }

  // 写事务从锁后重新读取产品和报价，再生成计划。两个并发执行会串行看到
  // 前一个事务新写入的有效报价，后一个只返回 unchanged，不重复插入。
  let items
  if (apply) {
    items = await options.store.runInWriteTransaction(async () => {
      const lockedItems = await buildPlan()
      const planned = lockedItems.filter((item) => item.status === 'planned')
      for (const item of planned) {
        await options.store.insertQuote({
          id: randomUUID(),
          productId: item.productId,
          assetCode: item.quoteAssetCode,
          unitPriceAtomicAmount: item.unitPriceAtomicAmount,
          unitPriceDecimals: item.unitPriceDecimals,
          currency: item.currency,
          source: item.source,
          validUntil: new Date(item.validUntil),
          capturedAt: now,
        })
      }
      return lockedItems
    })
    for (const item of items) if (item.status === 'planned') item.status = 'inserted'
  } else {
    items = await buildPlan()
  }

  return {
    mode: apply ? 'apply' : 'dry-run',
    databaseName,
    pricePerUnit: `${DEMO_UNIT_PRICE_TEXT} ${DEMO_QUOTE_CURRENCY} per unit`,
    items,
    insertedCount: items.filter((item) => item.status === 'inserted').length,
    unchangedCount: items.filter((item) => item.status === 'unchanged').length,
  }
}

async function main(): Promise<void> {
  require('dotenv/config')
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new DemoQuoteError('DATABASE_URL_MISSING', 'DATABASE_URL is required (apps/api/.env).')
  }
  const client = new Client({ connectionString, connectionTimeoutMillis: 10_000 })
  await client.connect()
  try {
    const store: DemoQuoteStore = {
      currentDatabaseName: async () => {
        const result = await client.query('SELECT current_database() AS name')
        return String(result.rows[0].name)
      },
      listProducts: async () =>
        (await client.query(
          `SELECT id,
                  external_ref AS "externalRef",
                  display_name AS "displayName",
                  asset_class_id AS "assetClassId",
                  asset_code AS "assetCode",
                  asset_decimals AS "assetDecimals",
                  state
             FROM app.products`,
        )).rows as DemoQuoteProductRow[],
      listQuotes: async (productIds) => {
        if (productIds.length === 0) return []
        return (await client.query(
          `SELECT product_id AS "productId",
                  asset_code AS "assetCode",
                  unit_price_atomic_amount AS "unitPriceAtomicAmount",
                  unit_price_decimals AS "unitPriceDecimals",
                  currency,
                  source,
                  valid_until AS "validUntil",
                  captured_at AS "capturedAt"
             FROM app.price_quotes
            WHERE product_id = ANY($1::uuid[])`,
          [productIds as string[]],
        )).rows as DemoQuoteExistingQuoteRow[]
      },
      insertQuote: async (row) => {
        await client.query(
          `INSERT INTO app.price_quotes
             (id, product_id, asset_code, unit_price_atomic_amount, unit_price_decimals,
              currency, source, valid_until, captured_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            row.id,
            row.productId,
            row.assetCode,
            row.unitPriceAtomicAmount,
            row.unitPriceDecimals,
            row.currency,
            row.source,
            row.validUntil,
            row.capturedAt,
          ],
        )
      },
      runInWriteTransaction: async (work) => {
        await client.query('BEGIN')
        try {
          await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [DEMO_QUOTE_LOCK_KEY])
          const result = await work()
          await client.query('COMMIT')
          return result
        } catch (error) {
          await client.query('ROLLBACK').catch(() => undefined)
          throw error
        }
      },
    }
    const result = await runDemoQuoteSeed({ argv: process.argv.slice(2), env: process.env, store })
    console.log(JSON.stringify(result, null, 2))
  } finally {
    await client.end()
  }
}

/** CLI 失败输出：已知 DemoQuoteError 输出 code+信息；其他一律通用 database error。 */
export function formatCliFailure(error: unknown): string {
  if (error instanceof DemoQuoteError) {
    return `demo-quote-seed failed [${error.code}]: ${error.message}`
  }
  // 不回显连接/认证/SQL 等原始细节。
  return 'demo-quote-seed failed: database error'
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(formatCliFailure(error))
    process.exit(1)
  })
}
