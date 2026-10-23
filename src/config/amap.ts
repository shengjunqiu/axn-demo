export const amapConfig = {
  key: import.meta.env.VITE_AMAP_KEY?.trim() ?? '',
  securityJsCode: import.meta.env.VITE_AMAP_SECURITY_CODE?.trim() ?? '',
  serviceHost: import.meta.env.VITE_AMAP_SERVICE_HOST?.trim() ?? '',
  origin: import.meta.env.VITE_AMAP_ROUTE_ORIGIN?.trim() || '成都东站',
  destination: import.meta.env.VITE_AMAP_ROUTE_DESTINATION?.trim() || '都江堰市人民政府',
  city: import.meta.env.VITE_AMAP_ROUTE_CITY?.trim() || '成都',
};
