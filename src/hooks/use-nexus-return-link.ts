'use client'

import { useEffect, useState } from 'react'

// One fetch per page load, shared by every navbar that shows the button.
let pending: Promise<string | null> | null = null

function loadReturnLink(): Promise<string | null> {
  if (!pending) {
    pending = fetch('/api/nexus/return-link', { credentials: 'same-origin', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { url: null }))
      .then((body: { url?: unknown }) => (typeof body?.url === 'string' ? body.url : null))
      .catch(() => {
        pending = null
        return null
      })
  }
  return pending
}

/** The platform URL for members who came from Cyberdelic Nexus, else null. */
export function useNexusReturnLink(): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    loadReturnLink().then((value) => {
      if (active) setUrl(value)
    })
    return () => {
      active = false
    }
  }, [])
  return url
}
