import './App.css'
import DocumentUpload from './DocumentUpload'

function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-3xl text-center">
        <h1 className="mb-3 text-center text-2xl font-bold text-blue-600">
          PDF Handwritten Text Recognition using AWS Textract
        </h1>

        <details className="mx-auto mb-6 max-w-xl rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            Technologies used to build this site
          </summary>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>React as the frontend</li>
            <li>Vite for the development server</li>
            <li>TypeScript for JSX/TSX files</li>
            <li>Multer for temporary file storage</li>
            <li>Node.js/Express for backend server</li>
            <li>GitHub Copilot AI to wire things up</li>
            <li>CORS for cross-domain requests</li>
            <li>Tailwind for styling</li>
            <li>AWS Textract for ICR/OCR/Machine Learning</li>
            <li>AWS S3 for cloud file storage</li>
          </ul>
        </details>

        <DocumentUpload />
      </div>
    </main>
  )
}

export default App
