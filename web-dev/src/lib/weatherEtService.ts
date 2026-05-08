import { getForecastLocation, getRainRecommendation } from '../../../packages/irrigation-domain/src';

export interface WeatherForecastDay {
  date: string;
  rainMm: number;
}

export interface WeatherOverviewData {
  todayRainMm: number;
  next24hRainMm: number;
  rainProbability: number;
  recommendation: string;
  dailyRain: WeatherForecastDay[];
}

export interface Et0ForecastDay {
  date: string;
  et0: number;
}

export { getForecastLocation, getRainRecommendation };

export async function fetchEt0Forecast(lat: number, lng: number, signal?: AbortSignal): Promise<Et0ForecastDay[]> {
  const query = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: 'et0_fao_evapotranspiration',
    timezone: 'auto',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`ET0 接口失败 ${response.status}`);
  }

  const payload = (await response.json()) as {
    daily?: {
      time?: string[];
      et0_fao_evapotranspiration?: number[];
    };
  };

  const times = payload.daily?.time ?? [];
  const values = payload.daily?.et0_fao_evapotranspiration ?? [];
  return times
    .map((date, index) => ({
      date,
      et0: Number(values[index] ?? 0),
    }))
    .filter((row) => row.date && Number.isFinite(row.et0));
}

export async function fetchWeatherOverview(lat: number, lng: number, signal?: AbortSignal): Promise<WeatherOverviewData> {
  const query = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: 'precipitation',
    daily: 'precipitation_sum,precipitation_probability_max',
    forecast_days: '7',
    timezone: 'auto',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`天气接口失败 ${response.status}`);
  }

  const payload = (await response.json()) as {
    hourly?: {
      time?: string[];
      precipitation?: number[];
    };
    daily?: {
      time?: string[];
      precipitation_sum?: number[];
      precipitation_probability_max?: number[];
    };
  };

  const hourlyRain = payload.hourly?.precipitation ?? [];
  const next24hRainMm = hourlyRain.slice(0, 24).reduce((total, value) => total + (value ?? 0), 0);
  const dailyTimes = payload.daily?.time ?? [];
  const dailyRain = payload.daily?.precipitation_sum ?? [];
  const probability = payload.daily?.precipitation_probability_max ?? [];
  const todayRainMm = Number(dailyRain[0] ?? 0);
  const rainProbability = Math.round(Number(probability[0] ?? 0));

  return {
    todayRainMm,
    next24hRainMm: Number(next24hRainMm.toFixed(1)),
    rainProbability,
    recommendation: getRainRecommendation(next24hRainMm, rainProbability),
    dailyRain: dailyTimes.map((date, index) => ({
      date,
      rainMm: Number(dailyRain[index] ?? 0),
    })),
  };
}
