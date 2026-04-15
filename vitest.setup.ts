// dotenv MUST be configured before any other import that reads process.env
import { config } from 'dotenv'
config({ path: '.env.local' })
import '@testing-library/jest-dom'
