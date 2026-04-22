import { useState, useEffect, useRef } from 'react'

const THRESHOLD = 70

export function usePullToRefresh(containerRef, onRefresh) {
  const [isPulling, setIsPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(null)
  const isPullingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)

  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e) => {
      if (el.scrollTop === 0) {
        startY.current = e.touches[0].clientY
        isPullingRef.current = false
      }
    }

    const onTouchMove = (e) => {
      if (startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      if (dy > 0 && el.scrollTop === 0) {
        const clamped = Math.min(dy, THRESHOLD * 1.5)
        setPullDistance(clamped)
        isPullingRef.current = dy >= THRESHOLD
        setIsPulling(dy >= THRESHOLD)
        if (dy > 10) e.preventDefault()
      }
    }

    const onTouchEnd = () => {
      if (startY.current !== null && isPullingRef.current) {
        onRefreshRef.current()
      }
      startY.current = null
      isPullingRef.current = false
      setPullDistance(0)
      setIsPulling(false)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [containerRef])

  return { isPulling, pullDistance }
}
