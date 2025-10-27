import { supabase, hasServiceRole } from './supabase';

const BUCKET = process.env.SUPABASE_BUCKET || 'user-uploads';
let bucketChecked = false;

export async function ensureBucket(): Promise<void> {
  if (bucketChecked) return;
  bucketChecked = true;
  if (!hasServiceRole) {
    // Without service role, we cannot create/manage buckets; assume it's created in dashboard
    return;
  }
  const { data } = await (supabase as any).storage.getBucket(BUCKET);
  if (!data) {
    await (supabase as any).storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB default; adjust as needed
    });
  }
}

export async function uploadBuffer(opts: {
  userId: string;
  filename: string;
  buffer: Buffer;
  contentType?: string;
}): Promise<{ path: string; signedUrl?: string }>{
  await ensureBucket();
  const path = `${opts.userId}/${Date.now()}-${opts.filename}`;

  const { error } = await (supabase as any).storage.from(BUCKET).upload(path, opts.buffer, {
    contentType: opts.contentType || 'application/octet-stream',
    upsert: false,
  });

  if (error) {
    throw error;
  }

  // Generate a short-lived signed URL (15 minutes)
  const { data: signed, error: signErr } = await (supabase as any)
    .storage
    .from(BUCKET)
    .createSignedUrl(path, 15 * 60);

  if (signErr) {
    // Not critical; return path only
    return { path };
  }

  return { path, signedUrl: signed?.signedUrl };
}
