declare global {
  interface Window {
    AMap?: any;
    _AMapSecurityConfig?: {
      securityJsCode?: string;
    };
  }
}

let amapLoader: Promise<any> | null = null;

type AmapScriptStatus = 'idle' | 'loading' | 'loaded' | 'error';

let amapScriptStatus: AmapScriptStatus = 'idle';

function getAmapKey() {
  return import.meta.env.VITE_AMAP_KEY?.trim();
}

export function isAmapConfigured() {
  return Boolean(getAmapKey());
}

export function getAmapDebugInfo() {
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE?.trim();
  const script = typeof document === 'undefined'
    ? null
    : document.querySelector<HTMLScriptElement>('script[data-amap-loader="true"]');

  return {
    hasKey: Boolean(getAmapKey()),
    keyTail: getAmapKey() ? getAmapKey()!.slice(-6) : '',
    hasSecurityCode: Boolean(securityJsCode),
    securityCodeTail: securityJsCode ? securityJsCode.slice(-6) : '',
    scriptInjected: Boolean(script),
    scriptStatus: amapScriptStatus,
    scriptSrc: script?.src ?? '',
    hasAMapGlobal: typeof window !== 'undefined' ? Boolean(window.AMap) : false,
  };
}

export function loadAmap() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('AMap 只能在浏览器环境中加载'));
  }

  if (window.AMap) {
    return Promise.resolve(window.AMap);
  }

  if (amapLoader) {
    return amapLoader;
  }

  const key = getAmapKey();
  if (!key) {
    return Promise.reject(new Error('未配置 VITE_AMAP_KEY'));
  }

  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE?.trim();
  if (securityJsCode) {
    window._AMapSecurityConfig = { securityJsCode };
  }

  amapLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-amap-loader="true"]');
    if (existing) {
      amapScriptStatus = 'loading';
      existing.addEventListener('load', () => resolve(window.AMap));
      existing.addEventListener('error', () => reject(new Error('高德地图脚本加载失败')));
      return;
    }

    const script = document.createElement('script');
    amapScriptStatus = 'loading';
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.Scale,AMap.ToolBar,AMap.CitySearch`;
    script.async = true;
    script.defer = true;
    script.dataset.amapLoader = 'true';
    script.onload = () => {
      amapScriptStatus = 'loaded';
      if (!window.AMap) {
        amapScriptStatus = 'error';
        reject(new Error('高德地图脚本未正确初始化'));
        return;
      }
      resolve(window.AMap);
    };
    script.onerror = () => {
      amapScriptStatus = 'error';
      reject(new Error('高德地图脚本加载失败'));
    };
    document.head.appendChild(script);
  });

  return amapLoader;
}
