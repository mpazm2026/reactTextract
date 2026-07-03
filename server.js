import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import {
  TextractClient,
  StartDocumentAnalysisCommand,
  GetDocumentAnalysisCommand,
} from '@aws-sdk/client-textract'

const app = express()
app.use(cors())

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')
    cb(null, isPdf)
  },
})

const s3Client = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' })
const textractClient = new TextractClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const pollDocumentAnalysis = async (jobId) => {
  let attempt = 0

  while (true) {
    attempt += 1
    console.log(`[Textract] Poll attempt ${attempt} for job ${jobId}`)

    const result = await textractClient.send(new GetDocumentAnalysisCommand({ JobId: jobId }))
    console.log(`[Textract] Job ${jobId} status: ${result.JobStatus}`)

    if (result.JobStatus === 'SUCCEEDED') {
      console.log(`[Textract] Job ${jobId} completed successfully.`)
      return result
    }

    if (result.JobStatus === 'FAILED') {
      console.error(`[Textract] Job ${jobId} failed.`)
      throw new Error('Textract analysis failed.')
    }

    console.log(`[Textract] Waiting 2 seconds before next poll for job ${jobId}`)
    await sleep(2000)
  }
}

app.post('/api/analyze-document', upload.single('document'), async (req, res) => {
  try {
    console.log('[Request] Received analyze-document request')

    if (!req.file?.buffer) {
      console.error('[Request] No document buffer found in request.')
      return res.status(400).json({ error: 'No document uploaded.' })
    }

    console.log(`[Request] File received: ${req.file.originalname} (${req.file.size} bytes, ${req.file.mimetype})`)

    const bucketName = process.env.AWS_S3_BUCKET_NAME
    if (!bucketName) {
      console.error('[Config] AWS_S3_BUCKET_NAME is not configured.')
      return res.status(500).json({ error: 'AWS_S3_BUCKET_NAME is not configured.' })
    }

    const key = `uploads/${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`
    console.log(`[S3] Upload starting for key: ${key}`)

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype || 'application/pdf',
      }),
    )

    console.log(`[S3] Upload completed for key: ${key}`)

    console.log(`[Textract] Starting analysis job for key: ${key}`)
    const startResult = await textractClient.send(
      new StartDocumentAnalysisCommand({
        DocumentLocation: {
          S3Object: {
            Bucket: bucketName,
            Name: key,
          },
        },
        FeatureTypes: ['TABLES', 'FORMS'],
      }),
    )

    const jobId = startResult.JobId
    console.log(`[Textract] Job started with ID: ${jobId}`)

    if (!jobId) {
      console.error('[Textract] Job ID was not returned from StartDocumentAnalysisCommand.')
      return res.status(500).json({ error: 'Textract job was not created.' })
    }

    const analysisPayload = await pollDocumentAnalysis(jobId)
    console.log(`[Textract] Returning analysis payload for job ${jobId}`)

    return res.json(analysisPayload)
  } catch (error) {
    console.error('[Route] Textract analysis failed:', error)
    return res.status(500).json({
      error: 'Failed to analyze document.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

const PORT = process.env.PORT ?? 3001

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
