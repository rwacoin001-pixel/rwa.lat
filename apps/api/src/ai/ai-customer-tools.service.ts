import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { UserOpsService } from '../notification/user-ops.service'

export const AI_ACCOUNT_SCOPES = ['balances', 'positions', 'orders', 'qualification'] as const
export type AiAccountScope = typeof AI_ACCOUNT_SCOPES[number]
export interface AiTicketContent { subject: string; body: string; category: 'support' | 'dispute' | 'appeal' | 'scam_report'; orderId?: string }

@Injectable()
export class AiCustomerToolsService {
  constructor(private readonly ds: DataSource, private readonly support: UserOpsService) {}

  async account(userId: string, scopes: AiAccountScope[]) {
    assertOwner(userId)
    if (!Array.isArray(scopes) || scopes.length < 1 || scopes.length > 4 || scopes.some(scope => !AI_ACCOUNT_SCOPES.includes(scope)) || new Set(scopes).size !== scopes.length) throw new BadRequestException('Select valid account information to share with the assistant')
    const [user] = await this.ds.query('SELECT status FROM app.users WHERE id=$1', [userId])
    if (!user) throw new NotFoundException('Account not found')
    const queries: Record<AiAccountScope, string> = {
      balances: `SELECT a.asset_code AS "assetCode",a.asset_decimals AS decimals,a.purpose,COALESCE(SUM(b.current_atomic_balance),0)::text AS "atomicAmount"
        FROM app.ledger_accounts a LEFT JOIN app.ledger_account_balances b ON b.account_id=a.id
        WHERE a.user_id=$1 AND a.owner_type='user' AND a.state<>'closed' AND a.purpose IN ('available','locked','pending')
        GROUP BY a.asset_code,a.asset_decimals,a.purpose ORDER BY a.asset_code,a.purpose LIMIT 40`,
      positions: `SELECT p.product_id AS "productId",c.display_name AS "productName",p.asset_code AS "assetCode",p.asset_decimals AS decimals,
        p.quantity_atomic_amount::text AS "quantityAtomic",p.cost_atomic_amount::text AS "costAtomic",p.outcome_key AS outcome,p.state
        FROM app.positions p JOIN app.products c ON c.id=p.product_id WHERE p.user_id=$1 AND p.state='active' ORDER BY p.updated_at DESC LIMIT 40`,
      orders: `SELECT o.id,o.product_id AS "productId",p.display_name AS "productName",o.state,o.requested_atomic_amount::text AS "requestedAtomic",
        o.filled_atomic_amount::text AS "filledAtomic",o.settlement_asset_code AS currency,o.settlement_asset_decimals AS decimals,o.submitted_at AS "submittedAt"
        FROM app.orders o JOIN app.products p ON p.id=o.product_id WHERE o.user_id=$1 ORDER BY o.submitted_at DESC LIMIT 20`,
      qualification: `SELECT product_scope AS "assetClass",decision,expires_at AS "expiresAt" FROM app.eligibility_profiles WHERE user_id=$1 ORDER BY decided_at DESC LIMIT 20`,
    }
    const values = await Promise.all(scopes.map(async scope => [scope, await this.ds.query(queries[scope], [userId])] as const))
    return { asOf: new Date().toISOString(), accountStatus: user.status, ...Object.fromEntries(values) }
  }

  async draftTicket(userId: string, input: AiTicketContent) {
    assertOwner(userId)
    if (!input.subject?.trim() || input.subject.length > 200 || !input.body?.trim() || input.body.length > 5000 || !['support', 'dispute', 'appeal', 'scam_report'].includes(input.category)) throw new BadRequestException('Invalid ticket content')
    if (input.orderId) {
      const [order] = await this.ds.query('SELECT id FROM app.orders WHERE id=$1 AND user_id=$2', [input.orderId, userId])
      if (!order) throw new NotFoundException('Order not found')
    }
    const content: AiTicketContent = { subject: input.subject.trim(), body: input.body.trim(), category: input.category, ...(input.orderId ? { orderId: input.orderId } : {}) }
    const [row] = await this.ds.query(`INSERT INTO app.ai_ticket_drafts(user_id,content,expires_at) VALUES ($1,$2::jsonb,now()+interval '20 minutes') RETURNING id,content,expires_at AS "expiresAt"`, [userId, JSON.stringify(content)])
    return row
  }

  async confirmTicket(userId: string, draftId: string, confirmed: boolean) {
    assertOwner(userId)
    if (confirmed !== true) throw new BadRequestException('Explicit ticket confirmation is required')
    const [draft] = await this.ds.query(`SELECT id,content,expires_at AS "expiresAt",ticket_id AS "ticketId" FROM app.ai_ticket_drafts WHERE id=$1 AND user_id=$2`, [draftId, userId])
    if (!draft) throw new NotFoundException('Ticket draft not found')
    if (!draft.ticketId && new Date(draft.expiresAt).getTime() <= Date.now()) throw new BadRequestException('Ticket draft expired. Review a new draft before confirming')
    const content = draft.content as AiTicketContent
    // A persisted immutable draft key makes retries safe across service restarts.
    const ticket = await this.support.createTicket({ author_user_id: userId, subject: content.subject, body: content.body, category: content.category, order_id: content.orderId, idempotencyKey: `ai-ticket:${draftId}` })
    await this.ds.query(`UPDATE app.ai_ticket_drafts SET ticket_id=$3,confirmed_at=COALESCE(confirmed_at,now()) WHERE id=$1 AND user_id=$2`, [draftId, userId, ticket.id])
    return { draftId, ticketId: ticket.id, reference: ticket.reference, state: ticket.status }
  }
}

function assertOwner(userId: string) {
  if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) throw new UnauthorizedException('A valid authenticated account is required')
}
