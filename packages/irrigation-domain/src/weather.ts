import type { Field } from './models';

const DEFAULT_ET0_LAT = 31.314011616279796;
const DEFAULT_ET0_LNG = 120.67671489354876;

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function getRainRecommendation(next24hRainMm: number, rainProbability: number) {
  if (next24hRainMm >= 8 || rainProbability >= 75) {
    return '建议跳灌';
  }
  if (next24hRainMm >= 3 || rainProbability >= 45) {
    return '建议延后';
  }
  return '可按计划灌溉';
}

export function getForecastLocation(fields: Field[]) {
  const locatedFields = fields
    .map((field) => field.geoCenter)
    .filter((center): center is [number, number] => (
      Array.isArray(center) &&
      center.length >= 2 &&
      Number.isFinite(center[0]) &&
      Number.isFinite(center[1])
    ));

  if (locatedFields.length === 0) {
    return { lat: DEFAULT_ET0_LAT, lng: DEFAULT_ET0_LNG };
  }

  return {
    lng: average(locatedFields.map(([lng]) => lng)),
    lat: average(locatedFields.map(([, lat]) => lat)),
  };
}
