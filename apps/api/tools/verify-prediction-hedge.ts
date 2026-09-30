/**
 * 验证脚本：内部盘收费(A+C) + 敞口/对冲数学。
 *
 * 只依赖纯函数模块（不连数据库、不发网络请求），可在任何环境跑：
 *   cd apps/api && ./node_modules/.bin/ts-node-transpile-only tools/verify-prediction-hedge.ts
 *
 * 期望值全部为人工推导，脚本里逐条断言；任一条不符即退出码 1。
 */
import { bpsToRate, feeOn, predictionFeeConfig } from '../src/prediction/prediction-fees'
import {
  formatDecimal18,
  hedgeCostAtomic,
  parseDecimal18,
  planExposure,
} from '../src/prediction/prediction-hedge-math'

const USDT = 1_000_000n // 1 USDT = 1e6 atomic
const S18 = 10n ** 18n

let checks = 0
let failed = 0

function check(name: string, actual: bigint | string | number | boolean, expected: bigint | string | number | boolean) {
  checks += 1
  const ok = actual === expected
  if (!ok) failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      actual=${actual}${ok ? '' : ` expected=${expected}`}`)
}

function section(title: string) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}`)
}

// ════════════════════════════════════════════════════════════════════
section('A. 收费原语 feeOn（向下取整，绝不超额）')
check('100 USDT 的 3% = 3 USDT', feeOn(100n * USDT, 300), 3n * USDT)
check('1 USDT 的 3% = 0.03 USDT', feeOn(1n * USDT, 300), 30_000n)
check('1 atomic 的 3% 向下取整 = 0', feeOn(1n, 300), 0n)
check('费率 0 → 不收', feeOn(100n * USDT, 0), 0n)
check('6% (600bps) 的 200 USDT = 12', feeOn(200n * USDT, 600), 12n * USDT)
check('bpsToRate(300) = 0.03', bpsToRate(300), 0.03)

// ════════════════════════════════════════════════════════════════════
section('B. 下注 → 结算 全链路算术（A+C 各 3%）')
// 用户下注 100 USDT，盘口价 0.10
const stake = 100n * USDT
const placeFee = feeOn(stake, 300)          // 3 USDT
const riskStake = stake - placeFee          // 97 USDT 进池
check('下注费 = 3 USDT', placeFee, 3n * USDT)
check('进池净本金 = 97 USDT', riskStake, 97n * USDT)
// 份额 = 净本金(6位) × 1e36 / (价格(18位) × 1e6)
const price18 = parseDecimal18('0.1')
const shares18 = (riskStake * S18 * S18) / (price18 * USDT)
check('份额 = 970 股', shares18, 970n * S18)
// 结算：毛派彩 = shares / 1e12 → atomic
const gross = shares18 / 10n ** 12n
check('毛派彩 = 970 USDT', gross, 970n * USDT)
const payoutFee = feeOn(gross, 300)
const net = gross - payoutFee
check('派彩费 = 29.1 USDT', payoutFee, 29_100_000n)
check('净派彩 = 940.9 USDT', net, 940_900_000n)
// 账本恒等式：用户实付 = 进池 + 下注费；池子赔完这笔后的净额 = 净本金 − 毛派彩
check('用户实付 = 进池 + 下注费', riskStake + placeFee, stake)
check('池子在这笔上的净额（负=亏损）= −873 USDT', riskStake - gross, -873n * USDT)
// 平台从这笔拿到的总收入 = 下注费 + 派彩费
check('平台总费用收入 = 32.1 USDT', placeFee + payoutFee, 32_100_000n)

// ════════════════════════════════════════════════════════════════════
section('C. 敞口核算：无派彩费（验证对冲公式本身）')
// 池子收 150 USDT；YES 累计 1000 股、NO 累计 100 股
const legs = [
  { tokenId: 'YES', tokenMappingId: null, outcome: 'Yes', shares18: 1000n * S18, minOrderSize18: null },
  { tokenId: 'NO', tokenMappingId: null, outcome: 'No', shares18: 100n * S18, minOrderSize18: null },
]
const planC = planExposure({ collectedAtomic: 150n * USDT, legs, payoutFeeBps: 0, ratioBps: 10_000 })
check('最坏情况 = −850 USDT（YES 赢时赔穿）', planC.worstCaseAtomic, -850n * USDT)
check('最好情况 = +50 USDT', planC.bestCaseAtomic, 50n * USDT)
check('需买入 YES 900 股（只买负债最高的腿）', planC.legs[0].targetShares18, 900n * S18)
check('NO 腿无需买入', planC.legs[1].targetShares18, 0n)

// ════════════════════════════════════════════════════════════════════
section('D. 敞口核算：派彩费 3%（真实配置）')
const planD = planExposure({ collectedAtomic: 150n * USDT, legs, payoutFeeBps: 300, ratioBps: 10_000 })
check('净负债 YES = 970 USDT', planD.legs[0].netLiabilityAtomic, 970n * USDT)
check('净负债 NO  = 97 USDT', planD.legs[1].netLiabilityAtomic, 97n * USDT)
check('最坏情况 = −820 USDT', planD.worstCaseAtomic, -820n * USDT)
check('最好情况 = +53 USDT', planD.bestCaseAtomic, 53n * USDT)
check('需买入 YES 873 股', planD.legs[0].targetShares18, 873n * S18)

// ════════════════════════════════════════════════════════════════════
section('E. 对冲成本与对冲后盈亏（价格 0.10）')
const costE = hedgeCostAtomic(873n * S18, price18)
check('对冲成本 = 87.3 USDT (873 × 0.10)', costE, 87_300_000n)
// 对冲后最坏 = worst + (maxNL − minNL) − 成本
const hedgedWorst = planD.worstCaseAtomic + (planD.maxNetLiabilityAtomic - planD.minNetLiabilityAtomic) - costE
check('对冲后最坏 = −34.3 USDT', hedgedWorst, -34_300_000n)
// 独立验算：两个 scenario 代入后应完全相等（这才是"拉平"的定义）
const pnlYes = 150n * USDT - planD.legs[0].netLiabilityAtomic - costE + 873n * S18 / 10n ** 12n
const pnlNo = 150n * USDT - planD.legs[1].netLiabilityAtomic - costE
check('scenario YES 盈亏 = −34.3 USDT', pnlYes, -34_300_000n)
check('scenario NO  盈亏 = −34.3 USDT', pnlNo, -34_300_000n)
check('对冲后两个 scenario 完全相等', pnlYes, pnlNo)
// 亏损被压缩：从 −820 → −34.3
const reductionBps = ((-planD.worstCaseAtomic + hedgedWorst) * 10_000n) / -planD.worstCaseAtomic
check('尾部风险压缩 ≈ 9581 bps (95.8%)', reductionBps, 9581n)

// ════════════════════════════════════════════════════════════════════
section('F. 对冲比例 50%（只对冲一半方向性风险）')
const planF = planExposure({ collectedAtomic: 150n * USDT, legs, payoutFeeBps: 300, ratioBps: 5_000 })
check('需买入 YES 436.5 股', planF.legs[0].targetShares18, 4365n * S18 / 10n)

// ════════════════════════════════════════════════════════════════════
section('G. 最小下单量守卫')
const legsG = [
  { tokenId: 'YES', tokenMappingId: null, outcome: 'Yes', shares18: 1000n * S18, minOrderSize18: (1000n * S18).toString() },
  { tokenId: 'NO', tokenMappingId: null, outcome: 'No', shares18: 100n * S18, minOrderSize18: null },
]
const planG = planExposure({ collectedAtomic: 150n * USDT, legs: legsG, payoutFeeBps: 300, ratioBps: 10_000 })
check('873 股 < 最小单 1000 股 → 标记 belowMinOrder', planG.legs[0].belowMinOrder, true)
check('无可执行腿', planG.anyExecutable, false)

// ════════════════════════════════════════════════════════════════════
section('H. 无下行风险的市场（两边都赚）')
const planH = planExposure({
  collectedAtomic: 1000n * USDT,
  legs: [
    { tokenId: 'YES', tokenMappingId: null, outcome: 'Yes', shares18: 300n * S18, minOrderSize18: null },
    { tokenId: 'NO', tokenMappingId: null, outcome: 'No', shares18: 200n * S18, minOrderSize18: null },
  ],
  payoutFeeBps: 300,
  ratioBps: 10_000,
})
check('最坏情况仍为正 = +709 USDT', planH.worstCaseAtomic, 709n * USDT)
// 注意：ratioBps=10000 的语义是"把各 scenario 拉平"，不区分盈或亏；
// 平台本来就不亏时由服务层按 skipReason='no_downside' 跳过，而不是在这里把目标置 0。
check('持平目标：买 97 股 YES（服务层会按 no_downside 跳过）', planH.legs[0].targetShares18, 97n * S18)

// ════════════════════════════════════════════════════════════════════
section('I. 18 位小数编解码往返')
check('parseDecimal18("0.62")', parseDecimal18('0.62'), 620_000_000_000_000_000n)
check('parseDecimal18("1")', parseDecimal18('1'), S18)
check('formatDecimal18(620000000000000000n)', formatDecimal18(620_000_000_000_000_000n), '0.62')
check('往返 0.033333333333333333', formatDecimal18(parseDecimal18('0.033333333333333333')), '0.033333333333333333')

// ════════════════════════════════════════════════════════════════════
section('J. 默认费率配置 = 3% + 3%')
const fees = predictionFeeConfig()
check('placeFeeBps 默认 300', fees.placeFeeBps, 300)
check('payoutFeeBps 默认 300', fees.payoutFeeBps, 300)

// ════════════════════════════════════════════════════════════════════
section('K. 回归：DB 的 numeric(38,18) 十进制串不能喂给 BigInt')
// 生产实测抓到的 bug：SUM(shares)::text 形如 "256.410256410256410256"，
// BigInt() 直接解析会抛 SyntaxError，被 worker 的 try/catch 吞掉 ⇒ 对冲决策静默零产出。
check('parseDecimal18("256.410256410256410256")', parseDecimal18('256.410256410256410256'), 256410256410256410256n)
let bigIntThrew = false
try { BigInt('256.410256410256410256') } catch { bigIntThrew = true }
check('BigInt("256.410256410256410256") 确实会抛（防止有人改回去）', bigIntThrew, true)

const legsK = [
  { tokenId: 'YES', tokenMappingId: null, outcome: 'Yes', shares18: parseDecimal18('256.410256410256410256'), minOrderSize18: '1.000000000000000000' },
  { tokenId: 'NO', tokenMappingId: null, outcome: 'No', shares18: parseDecimal18('0'), minOrderSize18: null },
]
const planK = planExposure({ collectedAtomic: 10n * USDT, legs: legsK, payoutFeeBps: 300, ratioBps: 10_000 })
check('毛负债 = 256.410256 USDT', planK.legs[0].grossLiabilityAtomic, 256_410_256n)
check('净负债 = 248.717949 USDT', planK.legs[0].netLiabilityAtomic, 248_717_949n)
check('最坏情况 = −238.717949 USDT（与生产实况同量级）', planK.worstCaseAtomic, -238_717_949n)

// min_order_size 同样是十进制串：用带小数的字符串对比；走 BigInt 路径会抛
const legsK2 = [
  { tokenId: 'YES', tokenMappingId: null, outcome: 'Yes', shares18: 1000n * S18, minOrderSize18: '1000.000000000000000000' },
  { tokenId: 'NO', tokenMappingId: null, outcome: 'No', shares18: 100n * S18, minOrderSize18: null },
]
const planK2 = planExposure({ collectedAtomic: 150n * USDT, legs: legsK2, payoutFeeBps: 300, ratioBps: 10_000 })
check('十进制串 min_order_size 解析成功 → 873 < 1000 判为低于最小单', planK2.legs[0].belowMinOrder, true)
check('无可执行腿', planK2.anyExecutable, false)

// ════════════════════════════════════════════════════════════════════
section('L. 单边盘（只有一个结果有投注）必须仍能算出对冲量')
// 关键：腿必须来自"市场全部未结算 outcome"，没被投注的一侧 shares = 0。
// 若只按"有投注的 token"建腿，min NL == max NL ⇒ 对冲量恒 0 ⇒ 庄家完全裸露。
// 这就是生产那个市场的实际形态（只有 YES 有投注）。
const oneSided = planExposure({
  collectedAtomic: 10n * USDT,
  legs: [
    { tokenId: 'YES', tokenMappingId: null, outcome: 'Yes', shares18: parseDecimal18('256.410256410256410256'), minOrderSize18: '1.000000000000000000' },
    { tokenId: 'NO', tokenMappingId: null, outcome: 'No', shares18: 0n, minOrderSize18: '1.000000000000000000' },
  ],
  payoutFeeBps: 300,
  ratioBps: 10_000,
})
check('单边盘：最坏 = −238.717949 USDT', oneSided.worstCaseAtomic, -238_717_949n)
check('单边盘：最好 = +10 USDT', oneSided.bestCaseAtomic, 10n * USDT)
check('单边盘：需买入 YES 248.717949 股（不是 0）', oneSided.legs[0].targetShares18, 248_717_949n * 10n ** 12n)
check('单边盘：NO 腿不需要买', oneSided.legs[1].targetShares18, 0n)
check('单边盘：有可执行腿 ⇒ 会真的提出对冲计划', oneSided.anyExecutable, true)
// 反面：如果漏掉没投注的那一侧，就会退化成"不需要对冲"（曾经的 bug 形态）
const wrongShape = planExposure({
  collectedAtomic: 10n * USDT,
  legs: [{ tokenId: 'YES', tokenMappingId: null, outcome: 'Yes', shares18: parseDecimal18('256.410256410256410256'), minOrderSize18: null }],
  payoutFeeBps: 300,
  ratioBps: 10_000,
})
check('反面对照：只给单腿时对冲量退化为 0（说明为何必须补全 outcome）', wrongShape.legs[0].targetShares18, 0n)
check('反面对照：无可执行腿', wrongShape.anyExecutable, false)

console.log(`\n${'═'.repeat(64)}`)
console.log(failed === 0
  ? `ALL ${checks} CHECKS PASSED`
  : `${failed} of ${checks} CHECKS FAILED`)
console.log('═'.repeat(64))
process.exit(failed === 0 ? 0 : 1)
