-- =============================================
-- CHAT SYSTEM FOR AI-AUTOMATION
-- =============================================

-- Chats table (like ChatGPT conversations)
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Chat metadata
    title VARCHAR(255) DEFAULT 'New Chat',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table (chat history)
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    
    -- Message content
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    
    -- For action messages (when user clicks "Generate Post", etc)
    action_type VARCHAR(50), -- 'post_generation', 'video_dubbing', 'image_generation', null for regular chat
    action_data JSONB, -- Stores result data from actions
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved Posts Library
-- Check if table exists and create it or alter it
DO $$ 
BEGIN
    -- Create table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'saved_posts') THEN
        CREATE TABLE saved_posts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
            
            -- Post Content
            text TEXT NOT NULL,
            hashtags JSONB DEFAULT '[]'::jsonb,
            call_to_action TEXT,
            
            -- Media
            image_url TEXT,
            image_storage_path TEXT,
            
            -- Optional metadata
            title VARCHAR(255),
            notes TEXT,
            source_url TEXT,
            
            -- Target platforms
            platforms JSONB DEFAULT '[]'::jsonb,
            
            -- Metadata
            saved_at TIMESTAMPTZ DEFAULT NOW(),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    ELSE
        -- Add chat_id column if it doesn't exist
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'saved_posts' 
            AND column_name = 'chat_id'
        ) THEN
            ALTER TABLE saved_posts ADD COLUMN chat_id UUID REFERENCES chats(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_account_id ON chats(account_id);
CREATE INDEX IF NOT EXISTS idx_chats_last_message ON chats(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_saved_posts_account_id ON saved_posts(account_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_chat_id ON saved_posts(chat_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;

-- Chats: Users can only see their own chats
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'chats' 
        AND policyname = 'Users can manage their own chats'
    ) THEN
        CREATE POLICY "Users can manage their own chats"
            ON chats FOR ALL
            USING (user_id = auth.uid());
    END IF;
END $$;

-- Chat Messages: Users can only see messages from their chats
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'chat_messages' 
        AND policyname = 'Users can manage messages in their chats'
    ) THEN
        CREATE POLICY "Users can manage messages in their chats"
            ON chat_messages FOR ALL
            USING (
                chat_id IN (
                    SELECT id FROM chats WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- Saved Posts: Users can manage posts for their accounts (update existing or create)
DO $$ 
BEGIN
    -- Drop old policy if exists
    DROP POLICY IF EXISTS "Users can manage saved posts" ON saved_posts;
    
    -- Create new policy
    CREATE POLICY "Users can manage saved posts"
        ON saved_posts FOR ALL
        USING (
            account_id IN (
                SELECT id FROM accounts WHERE user_id = auth.uid()
                UNION
                SELECT account_id FROM team_members WHERE user_id = auth.uid()
            )
        );
END $$;

-- =============================================
-- TRIGGERS
-- =============================================

-- Update updated_at timestamp (drop and recreate to avoid conflicts)
DROP TRIGGER IF EXISTS update_chats_updated_at ON chats;
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_saved_posts_updated_at ON saved_posts;
CREATE TRIGGER update_saved_posts_updated_at BEFORE UPDATE ON saved_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update chat's last_message_at when new message is added
CREATE OR REPLACE FUNCTION update_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chats 
    SET last_message_at = NEW.created_at
    WHERE id = NEW.chat_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_chat_last_message_trigger ON chat_messages;
CREATE TRIGGER update_chat_last_message_trigger 
    AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_chat_last_message();

-- Auto-generate chat title from first user message
CREATE OR REPLACE FUNCTION auto_generate_chat_title()
RETURNS TRIGGER AS $$
BEGIN
    -- Only for first user message in chat
    IF NEW.role = 'user' AND NOT EXISTS (
        SELECT 1 FROM chat_messages 
        WHERE chat_id = NEW.chat_id AND role = 'user' AND id != NEW.id
    ) THEN
        UPDATE chats 
        SET title = SUBSTRING(NEW.content FROM 1 FOR 50)
        WHERE id = NEW.chat_id AND title = 'New Chat';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS auto_generate_chat_title_trigger ON chat_messages;
CREATE TRIGGER auto_generate_chat_title_trigger 
    AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION auto_generate_chat_title();
