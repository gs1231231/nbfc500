// Performance utilities for NBFC Sathi

// Cache decorator for NestJS services
export function Cacheable(ttlSeconds: number = 300) {
  const cache = new Map<string, { data: any; expiry: number }>();
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const key = `${propertyKey}:${JSON.stringify(args)}`;
      const cached = cache.get(key);
      if (cached && Date.now() < cached.expiry) return cached.data;
      const result = await original.apply(this, args);
      cache.set(key, { data: result, expiry: Date.now() + ttlSeconds * 1000 });
      return result;
    };
  };
}
