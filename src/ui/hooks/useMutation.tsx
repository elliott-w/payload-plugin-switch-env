import { useState } from 'react'

type UseMutationResult<I, O> = {
  data: O | null
  error: Error | null
  loading: boolean
  mutate: (variables: I) => Promise<void>
}

type UseMutationOptions<O> = {
  onSuccess?: (data: O) => void
  onError?: (error: Error) => void
  fetchFn?: (url: string, options: RequestInit) => Promise<Response>
}

export function useMutation<I = any, O = any>(
  url: string,
  options?: UseMutationOptions<O>,
): UseMutationResult<I, O> {
  const [data, setData] = useState<O | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  const mutate = async (data: any) => {
    try {
      setLoading(true)
      const fetchFunction = options?.fetchFn || fetch
      const response = await fetchFunction(url, {
        method: 'POST', // or 'PUT', 'DELETE', depending on the mutation type
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        setLoading(false)
        setError(new Error(`Error: ${response.status} ${response.statusText}`))
        return
      }

      const result: O = await response.json()
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
  }

  return { data, error, loading, mutate }
}
