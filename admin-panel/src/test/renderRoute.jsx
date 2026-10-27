import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routes } from '../app/router'

export function renderRoute(path, state) {
  const router = createMemoryRouter(routes, { initialEntries: [{ pathname: path, state }] })
  render(<RouterProvider router={router} />)
  return router
}
