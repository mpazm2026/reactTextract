import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'

type TextractBlock = {
  BlockType?: string
  Id?: string
  Text?: string
  EntityTypes?: string[]
  Relationships?: Array<{ Type?: string; Ids?: string[] }>
}

type TextractPayload = {
  JobStatus?: string
  JobId?: string
  Blocks?: TextractBlock[]
}

type FormField = {
  key: string
  value: string
}

function DocumentUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [analysisResult, setAnalysisResult] = useState<TextractPayload | null>(null)
  const [activeView, setActiveView] = useState<'lines' | 'forms'>('lines')
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    if (file && file.type !== 'application/pdf') {
      setSelectedFile(null)
      setMessage('Please choose a PDF file only.')
      return
    }

    if (file && file.size > 1 * 1024 * 1024) {
      setSelectedFile(null)
      setMessage('File size exceeds the 1 MB limit.')
      return
    }

    setSelectedFile(file)
    setMessage('')
  }

  const handleReset = () => {
    setSelectedFile(null)
    setAnalysisResult(null)
    setMessage('')
    setActiveView('lines')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedFile) {
      setMessage('Please select a PDF document before submitting.')
      return
    }

    setIsLoading(true)
    const formData = new FormData()
    formData.append('document', selectedFile)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/api/analyze-document`, {
        method: 'POST',
        body: formData,
      })

      const contentType = response.headers.get('content-type') ?? ''
      let data: Record<string, unknown> | null = null

      if (contentType.includes('application/json')) {
        data = await response.json()
      } else {
        const text = await response.text()
        data = text ? { message: text } : null
      }

      if (!response.ok) {
        const messageFromPayload =
          typeof data?.error === 'string'
            ? data.error
            : typeof data?.message === 'string'
              ? data.message
              : response.statusText || 'Failed to analyze document.'

        throw new Error(messageFromPayload)
      }

      setAnalysisResult((data?.Blocks ? data : data?.result) as TextractPayload | null)
      setMessage(`Successfully uploaded ${selectedFile.name}. Analysis completed.`)
    } catch (error) {
      setAnalysisResult(null)
      setMessage(error instanceof Error ? error.message : 'An unexpected error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  const lines = useMemo(() => {
    const blocks = analysisResult?.Blocks ?? []
    const blocksById = new Map(blocks.map((block) => [block.Id, block]))

    const getTextFromBlock = (block?: TextractBlock): string => {
      if (!block) return ''
      if (block.Text) return block.Text.trim()

      const childIds = block.Relationships?.find((relation) => relation.Type === 'CHILD')?.Ids ?? []
      return childIds
        .map((id) => getTextFromBlock(blocksById.get(id)))
        .filter(Boolean)
        .join(' ')
        .trim()
    }

    return blocks
      .filter((block) => block.BlockType === 'LINE')
      .map((block) => getTextFromBlock(block))
      .filter(Boolean)
  }, [analysisResult])

  const formFields = useMemo(() => {
    const blocks = analysisResult?.Blocks ?? []
    const blocksById = new Map(blocks.map((block) => [block.Id, block]))

    const getTextFromBlock = (block?: TextractBlock): string => {
      if (!block) return ''
      if (block.Text) return block.Text.trim()

      const childIds = block.Relationships?.find((relation) => relation.Type === 'CHILD')?.Ids ?? []
      return childIds
        .map((id) => getTextFromBlock(blocksById.get(id)))
        .filter(Boolean)
        .join(' ')
        .trim()
    }

    const fields: FormField[] = []
    let pendingKey: string | null = null

    for (const block of blocks.filter((item) => item.BlockType === 'KEY_VALUE_SET')) {
      const entityType = block.EntityTypes?.[0] ?? ''
      const text = getTextFromBlock(block)

      if (!text) continue

      if (entityType === 'KEY') {
        pendingKey = text
      } else if (entityType === 'VALUE') {
        fields.push({ key: pendingKey ?? 'Unknown field', value: text })
        pendingKey = null
      }
    }

    return fields
  }, [analysisResult])

  return (
    <div className="relative w-full max-w-3xl">
      {isLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="flex flex-col items-center rounded-2xl bg-white/90 px-8 py-10 shadow-2xl">
            <div className="mb-4 h-14 w-14 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-lg font-semibold text-slate-800">Processing with AWS Textract</p>
            <p className="mt-2 text-sm text-slate-600">This may take a moment while we analyze your document.</p>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <label htmlFor="document-upload" className="mb-2 block text-sm font-medium text-slate-700">
        Upload PDF document
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={fileInputRef}
          id="document-upload"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
        >
          Choose PDF file
        </button>
        <span className="text-sm text-slate-500">
          {selectedFile ? selectedFile.name : 'No file selected'}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">Maximum file size: 1 MB. Only PDF documents are accepted.</p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          Submit
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      {message ? (
        <p
          className={`mt-4 text-sm ${message.startsWith('Successfully') ? 'text-green-600' : 'text-red-600'}`}
          role="status"
        >
          {message}
        </p>
      ) : null}

      {analysisResult ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveView('lines')}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${activeView === 'lines' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
            >
              Extracted text
            </button>
            <button
              type="button"
              onClick={() => setActiveView('forms')}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${activeView === 'forms' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
            >
              Form fields
            </button>
          </div>

          {activeView === 'lines' ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">Detected text lines</h3>
              {lines.length > 0 ? (
                <ol className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  {lines.map((line, index) => (
                    <li key={`${line}-${index}`} className="border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
                      <span className="mr-2 font-semibold text-slate-400">{index + 1}.</span>
                      {line}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500">
                  No text lines were detected.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">Forms and metadata</h3>
              {formFields.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-full text-left text-sm text-slate-700">
                    <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Field</th>
                        <th className="px-3 py-2">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formFields.map((field, index) => (
                        <tr key={`${field.key}-${index}`} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-700">{field.key}</td>
                          <td className="px-3 py-2">{field.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500">
                  No form fields were detected.
                </p>
              )}
            </div>
          )}
        </div>
      ) : null}
      </form>
    </div>
  )
}

export default DocumentUpload
