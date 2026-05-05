-- Add photo_urls array column for multi-photo support per recipe
ALTER TABLE meals ADD COLUMN IF NOT EXISTS photo_urls text[];

-- Backfill: migrate existing single photo_url into photo_urls array
UPDATE meals
SET photo_urls = ARRAY[photo_url]
WHERE photo_url IS NOT NULL
  AND photo_url <> ''
  AND (photo_urls IS NULL OR array_length(photo_urls, 1) IS NULL);
