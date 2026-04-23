import { getClient } from './client'
import type { RunsListResponse, OptimizationResult } from '../types/api'

export async function getRuns(): Promise<RunsListResponse> {
  const client = await getClient()
  const res = await client.get<RunsListResponse>('/api/runs')
  return res.data
}

export async function getRun(runId: string): Promise<OptimizationResult> {
  const client = await getClient()
  const res = await client.get<OptimizationResult>(`/api/runs/${runId}`)
  return res.data
}

export async function requestPdfExport(runId: string): Promise<void> {
  const client = await getClient()
  await client.post('/api/export/pdf', { run_id: runId })
}
