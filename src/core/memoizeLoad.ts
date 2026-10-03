// src/core/memoizeLoad.ts
//
// One in-flight or settled promise per key, so picking an experience twice
// downloads its chunk once. A rejected promise is forgotten, so Retry asks
// the network again instead of replaying the old failure.

export function memoizeLoad<K, V>(load: (key: K) => Promise<V>): (key: K) => Promise<V> {
  const cache = new Map<K, Promise<V>>();
  return (key) => {
    const cached = cache.get(key);
    if (cached) return cached;
    const promise = load(key);
    cache.set(key, promise);
    promise.catch(() => {
      if (cache.get(key) === promise) cache.delete(key);
    });
    return promise;
  };
}
