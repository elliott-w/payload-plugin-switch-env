import { useEffect, useState, useCallback } from 'react'

type UseQueryResult<T> = {
  data: T | null
  error: Error | null
  loading: boolean
  refetch: () => Promise<void>
}

type UseQueryOptions<T> = {
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
  fetchFn?: (url: string) => Promise<Response>
}

export function useQuery<T>(url: string, options?: UseQueryOptions<T>): UseQueryResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const fetchFunction = options?.fetchFn || fetch
      const response = await fetchFunction(url)
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`)
      }
      const result: T = await response.json()
      setData(result)
      if (options?.onSuccess) {
        options.onSuccess(result)
      }
    } catch (err) {
      const errorObj = err as Error
      setError(errorObj)
      if (options?.onError) {
        options.onError(errorObj)
      }
    } finally {
      setLoading(false)
    }
  }, [url, options])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const refetch = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  return { data, error, loading, refetch }
}
