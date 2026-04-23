import axios, { AxiosInstance } from 'axios'

let _client: AxiosInstance | null = null

export async function getClient(): Promise<AxiosInstance> {
  if (_client) return _client

  let baseURL: string
  if (typeof window !== 'undefined' && window.electron) {
    baseURL = await window.electron.getApiUrl()
  } else {
    // Fallback for browser-only dev
    baseURL = 'http://127.0.0.1:7842'
  }

  _client = axios.create({
    baseURL,
    timeout: 120_000,
    headers: { 'Content-Type': 'application/json' }
  })

  return _client
}
