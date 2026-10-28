import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash, randomUUID } from 'node:crypto'
import { DataSource, EntityManager } from 'typeorm'
import { InboundMailDto, MailListDto, MailReplyDto, MailStateDto } from './mail.dto'
import { normalizedSubject, sanitizeMailHtml } from './mail-html'

@Injectable()
export class MailService {
  constructor(private readonly ds: DataSource, private readonly config: ConfigService) {}

  async receive(input: InboundMailDto) {
    const attachments = input.attachments.map(item => {
      const content = item.content === undefined ? null : Buffer.from(item.content, 'base64')
      if (item.dropped ? content !== null || item.size <= 5242880 : !content || content.length !== item.size || item.size > 5242880 || content.toString('base64') !== item.content) {
        throw new BadRequestException('Invalid attachment size or content')
      }
      return { ...item, content, sha256: content ? createHash('sha256').update(content).digest('hex') : null }
    })
    if (attachments.reduce((sum, a) => sum + a.size, 0) + Buffer.byteLength(input.text) + Buffer.byteLength(input.html) > 10 * 1024 * 1024) throw new BadRequestException('Email exceeds 10 MB')
    return this.ds.transaction(async tx => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`mail-id:${input.messageId}`])
      const [existing] = await tx.query('SELECT id,thread_id FROM app.mail_messages WHERE message_id=$1', [input.messageId])
      if (existing) return { id: existing.id, threadId: existing.thread_id, replay: true }
      const subject = normalizedSubject(input.subject)
      const counterpart = input.from.toLowerCase()
      // Also serialize fallback threading so simultaneous first deliveries cannot create two threads.
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`mail-thread:${subject}:${counterpart}`])
      const refs = [...input.references, ...(input.inReplyTo ? [input.inReplyTo] : [])].reverse()
      // A guessed Message-ID must not let another sender join an unrelated conversation.
      let [thread] = await tx.query(`SELECT t.id FROM app.mail_threads t JOIN app.mail_messages m ON m.thread_id=t.id
        WHERE m.message_id=ANY($1::text[]) AND (t.counterpart=$2 OR m.from_address=$2 OR m.to_addresses ? $2 OR m.cc_addresses ? $2)
        ORDER BY array_position($1::text[],m.message_id) LIMIT 1`, [refs, counterpart])
      if (!thread) [thread] = await tx.query(`SELECT id FROM app.mail_threads WHERE normalized_subject=$1 AND counterpart=$2 AND updated_at>now()-interval '30 days' ORDER BY updated_at DESC LIMIT 1`, [subject, counterpart])
      if (!thread) [thread] = await tx.query(`INSERT INTO app.mail_threads(subject,normalized_subject,counterpart) VALUES ($1,$2,$3) RETURNING id`, [input.subject, subject, counterpart])
      const [message] = await tx.query(`INSERT INTO app.mail_messages(thread_id,direction,from_address,to_addresses,cc_addresses,subject,text_body,html_body,message_id,in_reply_to,references_ids,spam_verdict)
        VALUES ($1,'in',$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8,$9,$10::jsonb,$11) RETURNING id`,
      [thread.id, counterpart, JSON.stringify(input.to.map(a => a.toLowerCase())), JSON.stringify(input.cc.map(a => a.toLowerCase())), input.subject, input.text, sanitizeMailHtml(input.html), input.messageId, input.inReplyTo ?? null, JSON.stringify(input.references), input.spamVerdict ?? null])
      for (const a of attachments) await tx.query(`INSERT INTO app.mail_attachments(message_id,filename,content_type,size_bytes,content,sha256,dropped) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [message.id, a.filename, a.contentType, a.size, a.content, a.sha256, a.dropped])
      await tx.query('UPDATE app.mail_threads SET unread=true,archived=false,updated_at=now() WHERE id=$1', [thread.id])
      return { id: message.id, threadId: thread.id, replay: false }
    })
  }

  list(input: MailListDto) {
    return this.ds.query(`SELECT id,subject,counterpart,unread,archived,assignee,updated_at AS "updatedAt"
      FROM app.mail_threads WHERE ($1='all' AND NOT archived OR $1='unread' AND unread AND NOT archived OR $1='archived' AND archived)
      AND ($2='' OR position(lower($2) in lower(subject || ' ' || counterpart))>0 OR EXISTS
        (SELECT 1 FROM app.mail_messages m WHERE m.thread_id=mail_threads.id AND position(lower($2) in lower(m.text_body))>0))
      ORDER BY unread DESC,updated_at DESC,id LIMIT 50 OFFSET $3`, [input.filter ?? 'all', input.search ?? '', input.offset ?? 0])
  }
  async unreadCount() {
    const [row] = await this.ds.query('SELECT count(*)::integer AS count FROM app.mail_threads WHERE unread AND NOT archived')
    return row
  }
  async thread(id: string, offset = 0) {
    const [thread] = await this.ds.query('SELECT id,subject,counterpart,unread,archived,assignee FROM app.mail_threads WHERE id=$1', [id])
    if (!thread) throw new NotFoundException('邮件会话不存在')
    const messages = await this.ds.query(`SELECT m.id,m.direction,m.from_address AS "from",m.to_addresses AS "to",m.cc_addresses AS cc,m.subject,m.text_body AS text,m.html_body AS html,
      m.created_at AS "createdAt",m.delivery_state AS "deliveryState",m.spam_verdict AS "spamVerdict",
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'filename',a.filename,'size',a.size_bytes,'dropped',a.dropped)) FROM app.mail_attachments a WHERE a.message_id=m.id),'[]') AS attachments
      FROM app.mail_messages m WHERE m.id IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (ORDER BY created_at DESC,id DESC) AS n,
            sum(octet_length(text_body)+octet_length(html_body)) OVER (ORDER BY created_at DESC,id DESC) AS bytes
          FROM (SELECT * FROM app.mail_messages WHERE thread_id=$1 ORDER BY created_at DESC,id DESC LIMIT 10 OFFSET $2) page
        ) bounded WHERE n=1 OR bytes<=2097152
      ) ORDER BY m.created_at DESC,m.id DESC`, [id, offset])
    const [more] = await this.ds.query('SELECT EXISTS(SELECT 1 FROM app.mail_messages WHERE thread_id=$1 OFFSET $2) AS more', [id, offset + messages.length])
    return { thread, messages: messages.reverse(), offset, nextOffset: more.more ? offset + messages.length : null }
  }
  async attachment(id: string, actorId: string) {
    return this.ds.transaction(async tx => {
      const [a] = await tx.query('SELECT filename,content_type,content FROM app.mail_attachments WHERE id=$1 AND NOT dropped', [id])
      if (!a) throw new NotFoundException('附件不存在或超过大小限制')
      await this.audit(tx, actorId, 'admin.mail.attachment_downloaded', id)
      return { filename: a.filename, contentType: a.content_type, content: (a.content as Buffer).toString('base64') }
    })
  }
  async state(id: string, input: MailStateDto, actorId: string) {
    return this.ds.transaction(async tx => {
      const [row] = await tx.query(`UPDATE app.mail_threads SET unread=COALESCE($2,unread),archived=COALESCE($3,archived),
        assignee=CASE WHEN $4='me' THEN $5::uuid WHEN $4='none' THEN NULL ELSE assignee END WHERE id=$1 RETURNING id`,
      [id, input.unread ?? null, input.archived ?? null, input.assign ?? null, actorId])
      if (!row) throw new NotFoundException('邮件会话不存在')
      await this.audit(tx, actorId, 'admin.mail.updated', id, { ...input })
      return { ok: true }
    })
  }
  async reply(id: string, input: MailReplyDto, actorId: string) {
    if (this.config.get('MAIL_DELIVERY_WORKER_ENABLED') !== 'true') throw new ServiceUnavailableException('邮件发送尚未启用')
    const from = this.config.get<string>('MAIL_SUPPORT_FROM')?.trim() || 'A-REIT Support <support@a-reit.com>'
    if (from !== 'A-REIT Support <support@a-reit.com>') throw new ServiceUnavailableException('MAIL_SUPPORT_FROM must be the support mailbox')
    return this.ds.transaction(async tx => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`mail-reply:${input.requestKey}`])
      const [existing] = await tx.query('SELECT * FROM app.mail_messages WHERE request_key=$1', [input.requestKey])
      if (existing) {
        if (existing.thread_id !== id || existing.actor_id !== actorId || existing.text_body !== input.text || existing.spam_verdict !== (input.replyAll ? 'reply-all' : 'reply')) throw new ConflictException('此请求标识已用于另一封回复')
        return { id: existing.id, deliveryState: existing.delivery_state }
      }
      const [parent] = await tx.query(`SELECT * FROM app.mail_messages WHERE thread_id=$1 AND direction='in' ORDER BY created_at DESC,id DESC LIMIT 1`, [id])
      if (!parent) throw new NotFoundException('没有可回复的邮件')
      const recipients = replyRecipients(parent, input.replyAll)
      if (!recipients.to.length) throw new BadRequestException('没有可回复的收件人')
      const messageId = `<${randomUUID()}@a-reit.com>`
      const references = [...parent.references_ids, parent.message_id].slice(-100)
      const [message] = await tx.query(`INSERT INTO app.mail_messages(thread_id,direction,from_address,to_addresses,cc_addresses,subject,text_body,message_id,in_reply_to,references_ids,delivery_state,request_key,actor_id,spam_verdict)
        VALUES ($1,'out',$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8,$9::jsonb,'queued',$10,$11,$12) RETURNING id`,
      [id, from, JSON.stringify(recipients.to), JSON.stringify(recipients.cc), `Re: ${parent.subject.replace(/^(?:re:\s*)+/i, '').slice(0,990)}`, input.text, messageId, parent.message_id, JSON.stringify(references), input.requestKey, actorId, input.replyAll ? 'reply-all' : 'reply'])
      await tx.query(`INSERT INTO app.job_queue(queue_name,payload,state,dedup_key,max_attempts) VALUES ('support-mail',$1::jsonb,'pending',$2,5)`, [JSON.stringify({ messageId: message.id }), `support-mail:${message.id}`])
      await tx.query('UPDATE app.mail_threads SET updated_at=now() WHERE id=$1', [id])
      await this.audit(tx, actorId, 'admin.mail.reply_queued', id, { messageId: message.id, replyAll: input.replyAll })
      return { id: message.id, deliveryState: 'queued' }
    })
  }
  private audit(tx: EntityManager, actorId: string, action: string, id: string, metadata: Record<string, unknown> = {}) {
    return tx.query(`INSERT INTO app.audit_logs(id,actor_type,actor_id,action,object_type,object_id,request_id,metadata)
      VALUES (gen_random_uuid(),'admin',$1,$2,'mail_thread',$3,gen_random_uuid(),$4::jsonb)`, [actorId, action, id, JSON.stringify(metadata)])
  }
}

export function replyRecipients(parent: { from_address: string; to_addresses: string[]; cc_addresses: string[] }, all: boolean) {
  const own = (address: string) => address.toLowerCase().endsWith('@a-reit.com')
  const to = own(parent.from_address) ? [] : [parent.from_address.toLowerCase()]
  const cc = all ? [...new Set([...parent.to_addresses, ...parent.cc_addresses].map(a => a.toLowerCase()))].filter(a => !own(a) && !to.includes(a)) : []
  return { to, cc }
}
