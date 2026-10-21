import { vi } from 'vitest';

// next/headers-ийн cookies()/headers()-ийг санах ойн cookie хадгалалтаар солино (API route тестүүд)
const store = globalThis as unknown as { __cookieJar?: Map<string, string> };
const jar = () => (store.__cookieJar ??= new Map<string, string>());

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar().has(name) ? { name, value: jar().get(name) } : undefined),
    set: (name: string, value: string) => void jar().set(name, value),
    delete: (name: string) => void jar().delete(name),
  }),
  headers: async () => new Headers({ 'user-agent': 'vitest' }),
}));

// revalidatePath/Tag нь Next серверийн гадна ажиллахгүй
vi.mock('next/cache', () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
