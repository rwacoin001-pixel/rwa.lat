import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'

/**
 * 预测事件的收藏（星标）—— 每用户一份，跟随账号跨设备同步。
 * 纯加法：只读写 app.prediction_favorites，不涉及任何投注/派彩/费率逻辑。
 */
@Injectable()
export class PredictionFavoriteService {
  constructor(private readonly db: DataSource) {}

  async list(userId: string): Promise<{ eventId: string; createdAt: string }[]> {
    const rows = await this.db.query(
      `SELECT event_id, created_at FROM app.prediction_favorites
        WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [userId],
    )
    return rows.map((r: { event_id: string; created_at: Date | string }) => ({
      eventId: r.event_id,
      createdAt: String(r.created_at),
    }))
  }

  async add(userId: string, eventId: string) {
    await this.db.query(
      `INSERT INTO app.prediction_favorites (user_id, event_id) VALUES ($1, $2)
       ON CONFLICT (user_id, event_id) DO NOTHING`,
      [userId, eventId],
    )
    return { eventId, favorite: true }
  }

  async remove(userId: string, eventId: string) {
    await this.db.query(`DELETE FROM app.prediction_favorites WHERE user_id = $1 AND event_id = $2`, [userId, eventId])
    return { eventId, favorite: false }
  }
}
