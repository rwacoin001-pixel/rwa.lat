import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateCommunity1789690000000 implements MigrationInterface {
  name = 'CreateCommunity1789690000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.community_profiles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        handle varchar(32) NOT NULL,
        display_name varchar(64) NOT NULL,
        kind text NOT NULL DEFAULT 'persona' CHECK (kind IN ('persona', 'member', 'official')),
        avatar_url varchar(512),
        bio varchar(280),
        city varchar(64),
        country_code char(2),
        timezone varchar(64),
        persona jsonb,
        is_active boolean NOT NULL DEFAULT true,
        user_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE UNIQUE INDEX community_profiles_handle_idx ON app.community_profiles (handle);
      CREATE INDEX community_profiles_active_idx ON app.community_profiles (kind, is_active);

      CREATE TABLE app.community_topics (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug varchar(32) NOT NULL,
        title varchar(64) NOT NULL,
        description varchar(200),
        sort int NOT NULL DEFAULT 100,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE UNIQUE INDEX community_topics_slug_idx ON app.community_topics (slug);

      CREATE TABLE app.community_posts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id uuid NOT NULL REFERENCES app.community_profiles(id) ON DELETE CASCADE,
        body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
        images jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(images) = 'array'),
        topics jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(topics) = 'array'),
        source text NOT NULL DEFAULT 'original' CHECK (source IN ('original', 'rewrite', 'data', 'event', 'user', 'import')),
        state text NOT NULL DEFAULT 'published' CHECK (state IN ('draft', 'scheduled', 'published', 'hidden', 'removed')),
        scheduled_for timestamptz,
        like_count int NOT NULL DEFAULT 0 CHECK (like_count >= 0),
        comment_count int NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
        view_count int NOT NULL DEFAULT 0 CHECK (view_count >= 0),
        published_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK (state <> 'published' OR published_at IS NOT NULL)
      );

      CREATE INDEX community_posts_feed_idx
        ON app.community_posts (published_at DESC, id DESC) WHERE state = 'published';
      CREATE INDEX community_posts_profile_idx
        ON app.community_posts (profile_id, published_at DESC) WHERE state = 'published';
      CREATE INDEX community_posts_topics_idx
        ON app.community_posts USING gin (topics jsonb_path_ops);
      CREATE INDEX community_posts_schedule_idx
        ON app.community_posts (state, scheduled_for) WHERE state IN ('draft', 'scheduled');

      CREATE TABLE app.community_comments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id uuid NOT NULL REFERENCES app.community_posts(id) ON DELETE CASCADE,
        profile_id uuid NOT NULL REFERENCES app.community_profiles(id) ON DELETE CASCADE,
        parent_id uuid REFERENCES app.community_comments(id) ON DELETE CASCADE,
        body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
        like_count int NOT NULL DEFAULT 0 CHECK (like_count >= 0),
        state text NOT NULL DEFAULT 'published' CHECK (state IN ('published', 'hidden', 'removed')),
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX community_comments_post_idx
        ON app.community_comments (post_id, created_at) WHERE state = 'published';
      CREATE INDEX community_comments_parent_idx
        ON app.community_comments (parent_id) WHERE parent_id IS NOT NULL;

      CREATE TABLE app.community_likes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id uuid NOT NULL REFERENCES app.community_profiles(id) ON DELETE CASCADE,
        target_type text NOT NULL CHECK (target_type IN ('post', 'comment')),
        target_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE UNIQUE INDEX community_likes_unique_idx ON app.community_likes (profile_id, target_type, target_id);
      CREATE INDEX community_likes_target_idx ON app.community_likes (target_type, target_id);

      CREATE TABLE app.community_follows (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        follower_id uuid NOT NULL REFERENCES app.community_profiles(id) ON DELETE CASCADE,
        followee_id uuid NOT NULL REFERENCES app.community_profiles(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (follower_id <> followee_id)
      );

      CREATE UNIQUE INDEX community_follows_unique_idx ON app.community_follows (follower_id, followee_id);
      CREATE INDEX community_follows_followee_idx ON app.community_follows (followee_id);

      CREATE TABLE app.community_reports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        target_type text NOT NULL CHECK (target_type IN ('post', 'comment', 'profile')),
        target_id uuid NOT NULL,
        profile_id uuid REFERENCES app.community_profiles(id) ON DELETE SET NULL,
        reason varchar(280) NOT NULL,
        state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'reviewed', 'dismissed')),
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX community_reports_state_idx ON app.community_reports (state, created_at);

      CREATE TABLE app.community_content_queue (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id uuid NOT NULL REFERENCES app.community_profiles(id) ON DELETE CASCADE,
        kind text NOT NULL CHECK (kind IN ('post', 'comment')),
        payload jsonb NOT NULL,
        source text NOT NULL DEFAULT 'engine',
        state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'approved', 'rejected', 'published', 'failed')),
        scheduled_for timestamptz,
        review_note varchar(280),
        reviewed_by varchar(64),
        reviewed_at timestamptz,
        attempts int NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        result_post_id uuid,
        result_comment_id uuid,
        created_by varchar(64) NOT NULL DEFAULT 'engine',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX community_queue_state_idx ON app.community_content_queue (state, scheduled_for);

      INSERT INTO app.community_topics (id, slug, title, description, sort) VALUES
        ('c0000000-0000-4000-8000-000000000001', 'ai-compute', 'AI 算力', 'GPU 与算力经济：供需、价格与机会', 10),
        ('c0000000-0000-4000-8000-000000000002', 'rwa', '真实世界资产', '资产上链、收益来源与风险拆解', 20),
        ('c0000000-0000-4000-8000-000000000003', 'market', '行情讨论', '市场观察与观点（不构成投资建议）', 30),
        ('c0000000-0000-4000-8000-000000000004', 'newbie', '新手问答', '从这里开始，别怕问', 40),
        ('c0000000-0000-4000-8000-000000000005', 'security', '安全与合规', '资金安全、防诈骗与合规动态', 50),
        ('c0000000-0000-4000-8000-000000000006', 'community', '社区活动', 'AMA、投票、打卡与官方公告', 60),
        ('c0000000-0000-4000-8000-000000000007', 'lounge', '闲聊灌水', '帖子太正经也没意思', 70)
      ON CONFLICT (slug) DO NOTHING;

      COMMENT ON TABLE app.community_profiles IS
        'Community identities: operator run personas, real members and official accounts. persona jsonb holds the internal persona archive; never exposed publicly.';
      COMMENT ON TABLE app.community_posts IS
        'Community posts. state published feeds the public timeline; scheduled rows are operator content that becomes visible at published_at.';
      COMMENT ON TABLE app.community_content_queue IS
        'Reviewed content pipeline: engine output stays draft until approved, then publishing materializes a post/comment through the service layer.';
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS app.community_content_queue;
      DROP TABLE IF EXISTS app.community_reports;
      DROP TABLE IF EXISTS app.community_follows;
      DROP TABLE IF EXISTS app.community_likes;
      DROP TABLE IF EXISTS app.community_comments;
      DROP TABLE IF EXISTS app.community_posts;
      DROP TABLE IF EXISTS app.community_topics;
      DROP TABLE IF EXISTS app.community_profiles;
    `)
  }
}
