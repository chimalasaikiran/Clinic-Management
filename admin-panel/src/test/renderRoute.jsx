import { render, screen, waitFor } from '@testing-library/react'
import { expect } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routes } from '../app/router'
import { AuthContext } from '../features/auth/context/authContext'
import { RecordsSeedContext } from '../features/patients/context/patientRecordsContext'
import { authState } from './auth'
import { PATIENT_RECORDS } from './fixtures/patients'

// Renders the app at a path. By default a signed-in Super Admin is in session; pass `auth` (from authState)
// to test other people or a signed-out visitor. The in-memory modules (billing, clinical, reports) start with
// the sample records in test/fixtures/patients; pass `records` to replace them. Patients and appointments
// always come from the (mocked) API.
export function renderRoute(path, state, { auth = authState(), records = PATIENT_RECORDS } = {}) {
  const [pathname, query] = path.split('?')
  const router = createMemoryRouter(routes, { initialEntries: [{ pathname, search: query ? `?${query}` : '', state }] })
  render(
    <AuthContext.Provider value={auth}>
      <RecordsSeedContext.Provider value={records}>
        <RouterProvider router={router} />
      </RecordsSeedContext.Provider>
    </AuthContext.Provider>,
  )
  return router
}

// Renders a billing or finance route and waits until the (faked) billing ledger has loaded.
export async function renderBillingRoute(path, state, options) {
  const router = renderRoute(path, state, options)
  await waitFor(() => expect(screen.queryByText('Loading billing records…')).not.toBeInTheDocument())
  return router
}

// Renders an inventory or pharmacy route and waits until the (faked) stock state has loaded.
export async function renderStockRoute(path, state, options) {
  const router = renderRoute(path, state, options)
  await waitFor(() => expect(screen.queryByText('Loading stock and pharmacy records…')).not.toBeInTheDocument())
  return router
}
