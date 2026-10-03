// src/core/memoizeLoad.ts
//
// One in-flight or settled promise per key, so picking an experience twice
// downloads its chunk once. A rejected promise is forgotten rather than
// replayed; see showExperience in ui/runtime.ts for why a failed experience
// chunk is retried with a page reload instead.

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
