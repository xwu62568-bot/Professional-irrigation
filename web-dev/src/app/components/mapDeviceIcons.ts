import type { Device } from '../data/mockData';

export function compactStationLabel(value: string) {
  const trimmed = value.trim();
  const chMatch = trimmed.match(/CH\s*(\d+)/i);
  if (chMatch) {
    return chMatch[1];
  }

  const routeMatch = trimmed.match(/(\d+)\s*路/);
  if (routeMatch) {
    return routeMatch[1];
  }

  const namedStationMatch = trimmed.match(/站点\s*(\d+)/);
  if (namedStationMatch) {
    return namedStationMatch[1];
  }

  const stationMatch = trimmed.match(/S0*(\d+)/i);
  if (stationMatch) {
    return stationMatch[1];
  }

  return trimmed.slice(0, 3);
}

export function getStationDisplayValue(value: string) {
  const compact = compactStationLabel(value);
  return compact ? `S${compact}` : value.trim();
}

export function controllerGlyphSvg() {
  return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="5.5" width="15" height="13" rx="3"/><path d="M8 10h8"/><path d="M8 14h4.5"/><circle cx="16.5" cy="14" r="1.1" fill="currentColor" stroke="none"/><path d="M8 3.5v2"/><path d="M16 3.5v2"/><path d="M8 18.5v2"/><path d="M16 18.5v2"/></svg>';
}

export function sensorGlyphSvg(sensorType?: Device['sensorType']) {
  if (sensorType === 'rainfall') {
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7.3 10.5a3.9 3.9 0 0 1 7.2-1.7 3.2 3.2 0 1 1 1.7 6H8.4a2.8 2.8 0 0 1-1.1-4.3"/><path d="M9.3 16.1 8.4 18"/><path d="M12.2 16.1 11.3 19"/><path d="M15 16.1 14.1 18"/></svg>';
  }

  if (sensorType === 'temperature') {
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.7V6a2 2 0 0 0-4 0v8.7a4 4 0 1 0 4 0Z"/><path d="M12 10v5"/><path d="M10.2 18h3.6"/></svg>';
  }

  return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.2h11"/><path d="M8.3 6.2v5.8"/><path d="M15.7 6.2v5.8"/><path d="M7.4 12.4c1.2 1.7 2.8 2.5 4.6 2.5s3.4-.8 4.6-2.5"/><path d="M12 14.9v3.2"/><path d="M9.6 18.1h4.8"/><path d="M9.1 9.1c0 .9.7 1.6 1.6 1.6 0-.9-.7-1.6-1.6-1.6Z" fill="currentColor" stroke="none"/><path d="M12.9 8.2c0 .9.7 1.6 1.6 1.6 0-.9-.7-1.6-1.6-1.6Z" fill="currentColor" stroke="none"/></svg>';
}
