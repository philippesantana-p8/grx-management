-- GRX Management — Supabase Storage para anexos
-- Migration: 008_storage_attachments.sql

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'company-attachments',
    'company-attachments',
    FALSE,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY attachments_storage_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'company-attachments'
        AND (storage.foldername(name))[1]::uuid IN (SELECT public.auth_user_company_ids())
    );

CREATE POLICY attachments_storage_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'company-attachments'
        AND (storage.foldername(name))[1]::uuid IN (SELECT public.auth_user_company_ids())
    );

CREATE POLICY attachments_storage_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'company-attachments'
        AND (storage.foldername(name))[1]::uuid IN (SELECT public.auth_user_company_ids())
    );
