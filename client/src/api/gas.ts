// 與 Google Apps Script 伺服器溝通：網頁由 Apps Script 提供時，用 google.script.run 呼叫伺服器函式。
// 不經過任何公開網址，Google 會先確認使用者是公司帳號才讓網頁開啟。

declare global {
  interface Window {
    google?: any;
  }
}

export const isGasHosted = (): boolean =>
  typeof window !== 'undefined' && !!window.google?.script?.run;

export function callServer<T = any>(fn: string, ...args: any[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (!isGasHosted()) {
      reject(new Error('請從 Google Apps Script 的網頁應用程式網址開啟本系統'));
      return;
    }
    window.google.script.run
      .withSuccessHandler((v: T) => resolve(v))
      .withFailureHandler((e: any) => reject(new Error(e?.message || String(e))))
      [fn](...args);
  });
}
