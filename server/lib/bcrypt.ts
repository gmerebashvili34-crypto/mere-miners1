// Wrapper to use native bcrypt when available and fall back to bcryptjs on platforms
// where native bindings are not supported (e.g., some serverless environments).

type BcryptLike = {
  hash: (data: string, saltOrRounds: number | string) => Promise<string>;
  compare: (data: string, encrypted: string) => Promise<boolean>;
};

let cached: BcryptLike | null = null;

async function resolveImpl(): Promise<BcryptLike> {
  try {
    const mod: any = (await import('bcrypt')).default || (await import('bcrypt'));
    if (mod?.hash && mod?.compare) return mod as BcryptLike;
  } catch {
    // ignore
  }
  // fallback to bcryptjs (pure JS)
  const js: any = (await import('bcryptjs')).default || (await import('bcryptjs'));
  return js as BcryptLike;
}

async function resolve(): Promise<BcryptLike> {
  if (!cached) cached = await resolveImpl();
  return cached;
}

export async function hashPassword(password: string, rounds: number): Promise<string> {
  const b = await resolve();
  return b.hash(password, rounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const b = await resolve();
  return b.compare(password, hash);
}
