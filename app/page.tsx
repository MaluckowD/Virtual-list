'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const items = Array.from({ length: 10_000}, (_, i) => ({
  id: Math.random().toString(36).slice(2),
  text: String(i),
}));

interface UseFixedSizeListProps {
  itemsCount: number;
  itemHeight: number;
  overscan?: number;
  scrollingDelay?: number;
  getScrollElement: () => HTMLElement | null;
}

const DEFAULT_OVERSCAN = 3
const DEFAULT_SCROLLING_DELAY = 150

function useFixedSizeList(props: UseFixedSizeListProps) {
  const {
    itemsCount,
    itemHeight,
    overscan = DEFAULT_OVERSCAN,
    scrollingDelay = DEFAULT_SCROLLING_DELAY,
    getScrollElement
  } = props

  const [scrollTop, setScrollTop] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  const [listHeight, setListHeight] = useState(0)

  useLayoutEffect(() => {
    const scrollElement = getScrollElement()

    if (!scrollElement) {
      return
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) {
        return
      }

      const height = entry.borderBoxSize[0]?.blockSize ?? entry.target.getBoundingClientRect().height
      setListHeight(height)
    })

    resizeObserver.observe(scrollElement)
    
    return () => {
      resizeObserver.disconnect()
    }

  }, [getScrollElement])

  useLayoutEffect( () => {
    const scrollElement = getScrollElement()
    if (!scrollElement) return
    
    const handleScroll = () => {
      const scrollTop = scrollElement.scrollTop

      setScrollTop(scrollTop)
    }

    handleScroll()

    scrollElement.addEventListener("scroll", handleScroll)

    return () => scrollElement.removeEventListener("scroll", handleScroll)
  }, [getScrollElement])

  useEffect(() => {
    const scrollElement = getScrollElement()
    if (!scrollElement) return
    
    let timeoutId: number | null = null
    const handleScroll = () => {
      setIsScrolling(true)

      if (typeof timeoutId === 'number') {
        clearTimeout(timeoutId)
      }

      timeoutId = window.setTimeout(() => {
        setIsScrolling(false)
      }, scrollingDelay)
    }

    scrollElement.addEventListener("scroll", handleScroll)

    return () => {
      if (typeof timeoutId === 'number') {
        clearTimeout(timeoutId)
      }
      scrollElement.removeEventListener("scroll", handleScroll)
    }
  }, [getScrollElement])

  const { virtualItems, startIndex, endIndex } = useMemo(() => {
    let startRange = scrollTop
    let endRange = scrollTop + listHeight

    let startIndex = Math.floor( startRange / itemHeight)
    let endIndex = Math.ceil( endRange / itemHeight)

    startIndex = Math.max(0, startIndex - overscan)
    endIndex = Math.min(listHeight - 1, endIndex + overscan)

    const virtualItems = []

    for (let index = startIndex; index <= endIndex; index++) {
      virtualItems.push({
        index,
        offsetTop: index * itemHeight
      })
    }

    return { virtualItems, startIndex, endIndex }
  }, [scrollTop, listHeight, itemsCount])

  const totalListHeight = listHeight * itemHeight

  return {
    virtualItems,
    startIndex,
    endIndex,
    isScrolling,
    totalListHeight,
    listHeight
  }
}

const itemHeight = 40
const containerHeight = 600

export default function Home() {
  const [listItems, setListItems] = useState(items)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const { virtualItems, totalListHeight, listHeight } = useFixedSizeList({
    itemsCount: items.length,
    itemHeight,
    getScrollElement: useCallback(() => scrollRef.current, [] )
  })
  

  return (
    <div style={{ padding: '0 12px' }}>
      <h1>Virtualized List</h1>
      <div style = {{marginBottom: 12}}>
        <button onClick = {() => setListItems((items) => items.slice().reverse())}>Reverse List</button>
      </div>
      <div style = {{height: containerHeight, overflow: 'auto', border: '1px solid lightgray', position: 'relative'}} ref = {scrollRef}>
        <div style = {{ height: totalListHeight}}>
          {virtualItems.map((virtualItem, index) => {
            const item = listItems[virtualItem.index]
            return (
              <div
                key = {item.id}
                style = {{ 
                  height: itemHeight, 
                  padding: '6px 12px',
                  position: 'absolute',
                  top: 0,
                  transform: `translateY(${virtualItem.offsetTop}px)`
                }} 
                >
                  {item.text}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}