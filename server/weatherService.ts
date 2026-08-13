const ANN_ARBOR = {
  city: 'Ann Arbor',
  latitude: 42.2808,
  longitude: -83.743,
}

const OPEN_METEO_ENDPOINT = 'https://api.open-meteo.com/v1/forecast'

export type LocalWeather = {
  apparentTemperatureF: number
  condition: string
  isDay: boolean
  location: string
  temperatureF: number
}

type WeatherLocation = {
  city: string
  latitude: number
  longitude: number
}

type OpenMeteoPayload = {
  current?: {
    apparent_temperature?: unknown
    is_day?: unknown
    temperature_2m?: unknown
    weather_code?: unknown
  }
}

const readHeader = (headers: Headers, name: string) => headers.get(name)?.trim() || ''

const finiteCoordinate = (value: string, min: number, max: number) => {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined
}

const cleanCity = (value: string) => {
  if (!value) return ''
  try {
    return decodeURIComponent(value.replace(/\+/g, ' ')).replace(/[<>\r\n]/g, '').trim().slice(0, 80)
  } catch {
    return value.replace(/[<>\r\n]/g, '').trim().slice(0, 80)
  }
}

export function weatherLocationFromHeaders(headers: Headers): WeatherLocation {
  const latitude = finiteCoordinate(readHeader(headers, 'x-vercel-ip-latitude'), -90, 90)
  const longitude = finiteCoordinate(readHeader(headers, 'x-vercel-ip-longitude'), -180, 180)
  const city = cleanCity(readHeader(headers, 'x-vercel-ip-city'))

  if (latitude === undefined || longitude === undefined) return ANN_ARBOR

  return {
    city: city || 'Local weather',
    // Coarse precision is plenty for a city-level forecast and avoids sharing
    // unnecessarily precise request-location data with the forecast provider.
    latitude: Math.round(latitude * 100) / 100,
    longitude: Math.round(longitude * 100) / 100,
  }
}

export function conditionForWeatherCode(code: number) {
  if (code === 0) return 'Clear'
  if ([1, 2].includes(code)) return 'Mostly clear'
  if (code === 3) return 'Cloudy'
  if ([45, 48].includes(code)) return 'Foggy'
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow'
  if ([95, 96, 99].includes(code)) return 'Storms'
  return 'Current weather'
}

const finiteNumber = (value: unknown) => (
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
)

export async function getLocalWeather(
  headers: Headers,
  fetcher: typeof fetch = fetch,
): Promise<LocalWeather> {
  const location = weatherLocationFromHeaders(headers)
  const url = new URL(OPEN_METEO_ENDPOINT)
  url.search = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'temperature_2m,apparent_temperature,weather_code,is_day',
    temperature_unit: 'fahrenheit',
    timezone: 'auto',
    forecast_days: '1',
  }).toString()

  const response = await fetcher(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(4_000),
  })
  if (!response.ok) throw new Error(`Weather provider returned ${response.status}.`)

  const payload = await response.json() as OpenMeteoPayload
  const temperature = finiteNumber(payload.current?.temperature_2m)
  const apparentTemperature = finiteNumber(payload.current?.apparent_temperature)
  const weatherCode = finiteNumber(payload.current?.weather_code)
  const isDay = finiteNumber(payload.current?.is_day)

  if (temperature === undefined || apparentTemperature === undefined || weatherCode === undefined) {
    throw new Error('Weather provider returned an incomplete response.')
  }

  return {
    apparentTemperatureF: Math.round(apparentTemperature),
    condition: conditionForWeatherCode(weatherCode),
    isDay: isDay !== 0,
    location: location.city,
    temperatureF: Math.round(temperature),
  }
}
