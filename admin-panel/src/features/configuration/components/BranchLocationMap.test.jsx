import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { geocodeAddress } from '../geocode'
import BranchLocationMap from './BranchLocationMap'

// MapLibre needs WebGL, which jsdom lacks; the wrapper around it is what is under test.
vi.mock('@/components/ui/map', () => ({
  Map: ({ children }) => <div data-testid="map">{children}</div>,
  MapControls: () => null,
  MapMarker: ({ longitude, latitude, children }) => <div data-testid="marker" data-at={`${latitude},${longitude}`}>{children}</div>,
  MarkerContent: ({ children }) => <div>{children}</div>,
  MarkerLabel: ({ children }) => <span>{children}</span>,
  useMap: () => ({ map: null, isLoaded: false }),
}))

describe('BranchLocationMap', () => {
  it('shows no marker until a pin is placed and links to a map search for the address', () => {
    render(<BranchLocationMap value={null} onChange={() => {}} address="DLF Road, Hyderabad" />)
    expect(screen.queryByTestId('marker')).not.toBeInTheDocument()
    expect(screen.getByText('No pin yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Verify location/ })).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('DLF Road, Hyderabad')))
  })

  it('shows the pin and its coordinates once placed', () => {
    render(<BranchLocationMap value={{ lat: 17.4582, lng: 78.3615 }} onChange={() => {}} address="" />)
    expect(screen.getByTestId('marker')).toHaveAttribute('data-at', '17.4582,78.3615')
    expect(screen.getByText(/17\.4582° N, 78\.3615° E/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Verify location/ })).not.toBeInTheDocument()
  })

  it('looks the address up and places the pin from the result', async () => {
    geocodeAddress.mockResolvedValueOnce({ lat: 16.5, lng: 80.6 })
    const onChange = vi.fn()
    render(<BranchLocationMap value={null} onChange={onChange} address="DLF Road" queries={['DLF Road, India', '500032, India']} />)

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ lat: 16.5, lng: 80.6 }))
    expect(geocodeAddress).toHaveBeenCalledWith(['DLF Road, India', '500032, India'], expect.any(AbortSignal))
    expect(await screen.findByText(/Pin placed from the address/)).toBeInTheDocument()
  })

  it('asks the user to place the pin when the address is not found', async () => {
    render(<BranchLocationMap value={null} onChange={() => {}} address="Nowhere" queries={['Nowhere, India']} />)
    expect(await screen.findByText(/could not find this address/)).toBeInTheDocument()
  })
})
