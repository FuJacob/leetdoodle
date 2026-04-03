ALTER TABLE submissions.outbox
    ADD COLUMN published_at TIMESTAMPTZ,
    ADD COLUMN claim_token UUID,
    ADD COLUMN claim_expires_at TIMESTAMPTZ,
    ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN last_error TEXT;

CREATE INDEX idx_outbox_unpublished_created_at
    ON submissions.outbox (created_at)
    WHERE published_at IS NULL;

CREATE INDEX idx_outbox_unpublished_claim_expires_at
    ON submissions.outbox (claim_expires_at)
    WHERE published_at IS NULL;
