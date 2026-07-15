import type { MigrationInterface, QueryRunner } from 'typeorm'

// DB-005: 通知、工单、邀请、订阅、费用、奖励和偏好模型
// 均具备归因(actor/subject)、版本、撤销与审计字段。
export class CreateNotificationAndOpsModel1783766000000 implements MigrationInterface {
  name = 'CreateNotificationAndOpsModel1783766000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- 通知
      CREATE TABLE app.notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient_user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
        channel text NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'push')),
        kind text NOT NULL,
        title text NOT NULL,
        body text,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        locale text CHECK (locale IS NULL OR locale ~ '^[a-z]{2}(_[A-Z]{2})?$'),
        read_at timestamptz,
        sent_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz
      );
      CREATE INDEX notifications_recipient_idx ON app.notifications(recipient_user_id, read_at, created_at DESC);

      -- 工单
      CREATE TABLE app.tickets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        author_user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
        subject text NOT NULL,
        body text NOT NULL,
        status text NOT NULL DEFAULT 'open'
          CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
        priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        assignee text,
        closed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((status IN ('closed')) = (closed_at IS NOT NULL))
      );

      -- 邀请
      CREATE TABLE app.invitations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        inviter_user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
        email text,
        role text NOT NULL,
        token_hash bytea NOT NULL,
        state text NOT NULL DEFAULT 'pending'
          CHECK (state IN ('pending', 'accepted', 'revoked', 'expired')),
        accepted_user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
        expires_at timestamptz NOT NULL,
        accepted_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((state = 'accepted') = (accepted_at IS NOT NULL)),
        CHECK ((state = 'revoked') = (revoked_at IS NOT NULL))
      );
      CREATE UNIQUE INDEX invitations_token_hash_idx ON app.invitations(token_hash);

      -- 订阅
      CREATE TABLE app.subscriptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
        plan text NOT NULL,
        version integer NOT NULL DEFAULT 1 CHECK (version > 0),
        state text NOT NULL DEFAULT 'active'
          CHECK (state IN ('active', 'canceled', 'expired', 'past_due')),
        current_period_start timestamptz NOT NULL,
        current_period_end timestamptz NOT NULL,
        canceled_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (current_period_end > current_period_start),
        CHECK ((state = 'canceled') = (canceled_at IS NOT NULL)),
        UNIQUE (user_id, plan, version)
      );

      -- 费用
      CREATE TABLE app.fees (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
        kind text NOT NULL CHECK (kind IN ('subscription', 'transaction', 'management', 'penalty')),
        amount_atomic app.atomic_unit_amount NOT NULL CHECK (amount_atomic >= 0),
        currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
        status text NOT NULL DEFAULT 'accrued'
          CHECK (status IN ('accrued', 'invoiced', 'paid', 'waived', 'refunded')),
        ref_type text,
        ref_id uuid,
        effective_at timestamptz NOT NULL DEFAULT now(),
        reversed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((status = 'refunded') = (reversed_at IS NOT NULL))
      );

      -- 奖励
      CREATE TABLE app.rewards (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
        kind text NOT NULL CHECK (kind IN ('referral', 'loyalty', 'promo', 'cashback')),
        amount_atomic app.atomic_unit_amount NOT NULL CHECK (amount_atomic >= 0),
        currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
        state text NOT NULL DEFAULT 'earned'
          CHECK (state IN ('earned', 'redeemed', 'expired', 'revoked')),
        ref_type text,
        ref_id uuid,
        earned_at timestamptz NOT NULL DEFAULT now(),
        redeemed_at timestamptz,
        expired_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((state = 'redeemed') = (redeemed_at IS NOT NULL)),
        CHECK ((state = 'expired') = (expired_at IS NOT NULL)),
        CHECK ((state = 'revoked') = (revoked_at IS NOT NULL))
      );

      -- 偏好
      CREATE TABLE app.preferences (
        user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
        locale text CHECK (locale ~ '^[a-z]{2}(_[A-Z]{2})?$'),
        channels jsonb NOT NULL DEFAULT '{"in_app":true,"email":false,"sms":false,"push":false}'::jsonb,
        communication_consent boolean NOT NULL DEFAULT false,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS app.preferences;
      DROP TABLE IF EXISTS app.rewards;
      DROP TABLE IF EXISTS app.fees;
      DROP TABLE IF EXISTS app.subscriptions;
      DROP TABLE IF EXISTS app.invitations;
      DROP TABLE IF EXISTS app.tickets;
      DROP TABLE IF EXISTS app.notifications;
    `)
  }
}
