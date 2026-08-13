import assert from 'node:assert/strict'
import test from 'node:test'
import {
  conditionForWeatherCode,
  getLocalWeather,
  weatherLocationFromHeaders,
} from '../server/weatherService.ts'

test('weather location uses coarse Vercel coordinates and decodes the city', () => {
  const headers = new Headers({
    'x-vercel-ip-city': 'Ann%20Arbor',
    'x-vercel-ip-latitude': '42.279594',
    'x-vercel-ip-longitude': '-83.732124',
  })

  assert.deepEqual(weatherLocationFromHeaders(headers), {
    city: 'Ann Arbor',
    latitude: 42.28,
    longitude: -83.73,
  })
})

test('weather location falls back to Ann Arbor without deployment location headers', () => {
  assert.deepEqual(weatherLocationFromHeaders(new Headers()), {
    city: 'Ann Arbor',
    latitude: 42.2808,
    longitude: -83.743,
  })
})

test('weather response is rounded and labeled for the dashboard', async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input))
    assert.equal(url.searchParams.get('temperature_unit'), 'fahrenheit')
    return new Response(JSON.stringify({
      current: {
        apparent_temperature: 71.6,
        is_day: 1,
        temperature_2m: 73.4,
        weather_code: 2,
      },
    }), { status: 200 })
  }

  assert.deepEqual(await getLocalWeather(new Headers(), fetcher), {
    apparentTemperatureF: 72,
    condition: 'Mostly clear',
    isDay: true,
    location: 'Ann Arbor',
    temperatureF: 73,
  })
})

test('weather codes collapse into concise dashboard labels', () => {
  assert.equal(conditionForWeatherCode(0), 'Clear')
  assert.equal(conditionForWeatherCode(63), 'Rain')
  assert.equal(conditionForWeatherCode(95), 'Storms')
  assert.equal(conditionForWeatherCode(500), 'Current weather')
})
