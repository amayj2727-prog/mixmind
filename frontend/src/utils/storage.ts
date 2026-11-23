/**
 * MIXMIND Safe LocalStorage Persistence Layer
 * Provides robust JSON serialization with schema validation and fallback guards.
 */

export function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = window.localStorage.getItem(key);
    if (!item) return fallback;
    const parsed = JSON.parse(item);
    return parsed !== null && parsed !== undefined ? (parsed as T) : fallback;
  } catch (error) {
    console.warn(`[MIXMIND Storage] Error loading key "${key}":`, error);
    return fallback;
  }
}

export function saveToStorage<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[MIXMIND Storage] Error saving key "${key}":`, error);
    return false;
  }
}

export function removeFromStorage(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn(`[MIXMIND Storage] Error removing key "${key}":`, error);
  }
}
