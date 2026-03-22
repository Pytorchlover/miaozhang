// 本地存储工具

const STORAGE_PREFIX = 'accounting_';

/**
 * 设置存储
 */
export function setStorage(key: string, value: any): void {
  wx.setStorageSync(STORAGE_PREFIX + key, value);
}

/**
 * 获取存储
 */
export function getStorage<T = any>(key: string, defaultValue?: T): T {
  const value = wx.getStorageSync(STORAGE_PREFIX + key);
  return value !== '' ? value : (defaultValue ?? null);
}

/**
 * 移除存储
 */
export function removeStorage(key: string): void {
  wx.removeStorageSync(STORAGE_PREFIX + key);
}

/**
 * 清除所有存储
 */
export function clearStorage(): void {
  wx.clearStorageSync();
}

// 常用存储键
export const StorageKeys = {
  DEEPSEEK_API_KEY: 'deepseek_api_key',
  USER_FINANCIAL: 'user_financial',
  SETTINGS: 'settings',
  LAST_LOGIN: 'last_login'
} as const;
