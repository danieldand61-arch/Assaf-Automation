-- Fix old video_dubbing records that stored bytes instead of credits
-- Convert bytes to estimated credits: ~1 credit per 3MB

-- Update video_dubbing records where total_tokens > 10000 (likely bytes)
UPDATE credits_usage
SET 
    input_tokens = GREATEST(1, (total_tokens::decimal / (1024 * 1024 * 3))::integer),
    output_tokens = 0,
    total_tokens = GREATEST(1, (total_tokens::decimal / (1024 * 1024 * 3))::integer),
    request_metadata = jsonb_set(
        COALESCE(request_metadata, '{}'::jsonb),
        '{migrated}',
        'true'::jsonb
    ),
    request_metadata = jsonb_set(
        request_metadata,
        '{original_bytes}',
        to_jsonb(total_tokens)
    )
WHERE 
    service_type = 'video_dubbing'
    AND total_tokens > 10000
    AND NOT (request_metadata->>'migrated' = 'true');

-- Show what was updated
SELECT 
    id,
    user_id,
    service_type,
    input_tokens as credits,
    request_metadata->>'original_bytes' as original_bytes,
    (request_metadata->>'original_bytes')::bigint / (1024 * 1024) as original_mb,
    created_at
FROM credits_usage
WHERE 
    service_type = 'video_dubbing'
    AND request_metadata->>'migrated' = 'true'
ORDER BY created_at DESC;
