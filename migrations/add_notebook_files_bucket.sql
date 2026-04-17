-- ============================================================================
-- NOTEBOOK FILES STORAGE BUCKET
-- Required for notebook attachments (images, PDFs, text files)
-- Frontend uploads to 'notebook-files' bucket — must exist in DB
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('notebook-files', 'notebook-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Clean up any leftover policies
DROP POLICY IF EXISTS "Authenticated users can upload notebook files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view notebook files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own notebook files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload notebook files" ON storage.objects;

-- 3. RLS: Anyone can read (Gemini needs to fetch public URLs)
CREATE POLICY "Public can view notebook files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'notebook-files');

-- 4. RLS: Authenticated users can upload
CREATE POLICY "Authenticated users can upload notebook files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'notebook-files');

-- 5. RLS: Users can delete their own files
CREATE POLICY "Users can delete own notebook files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'notebook-files' AND owner = auth.uid());

-- 6. Verify
SELECT
  'bucket exists' as check_type,
  COUNT(*) as result
FROM storage.buckets
WHERE id = 'notebook-files'
UNION ALL
SELECT
  'bucket is public' as check_type,
  COUNT(*) as result
FROM storage.buckets
WHERE id = 'notebook-files' AND public = true
UNION ALL
SELECT
  'policies count' as check_type,
  COUNT(*) as result
FROM pg_policies
WHERE tablename = 'objects' AND policyname LIKE '%notebook%';

-- Expected:
-- bucket exists: 1
-- bucket is public: 1
-- policies count: 3
