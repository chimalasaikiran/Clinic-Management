import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// The suite renders whole pages in parallel workers; allow slow machines time for async queries.
configure({ asyncUtilTimeout: 5000 })

afterEach(cleanup)
