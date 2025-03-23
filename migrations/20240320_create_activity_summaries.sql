-- Create user activity summaries table
CREATE TABLE IF NOT EXISTS user_activity_summaries (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    trades_30d INTEGER NOT NULL DEFAULT 0,
    best_performer VARCHAR(10),
    best_gain DECIMAL(10,2),
    worst_performer VARCHAR(10),
    worst_gain DECIMAL(10,2),
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_activity_summaries_last_updated ON user_activity_summaries(last_updated);

-- Add trigger to update last_updated
CREATE OR REPLACE FUNCTION update_activity_summaries_last_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_activity_summaries_last_updated
    BEFORE UPDATE ON user_activity_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_activity_summaries_last_updated(); 