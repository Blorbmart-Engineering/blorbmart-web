import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { applySeo, seoForPath } from '../lib/seo'

/**
 * Writes each route's default title, description, canonical URL and robots
 * rule. Store and event screens refine theirs once their data arrives.
 */
export default function RouteSeo() {
  const { pathname } = useLocation()
  useEffect(() => {
    applySeo(seoForPath(pathname))
  }, [pathname])
  return null
}
