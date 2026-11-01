'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const items = Array.from({ length: 10_000}, (_, i) => ({
  id: Math.random().toString(36).slice(2),
  text: String(i),
}));

const itemHeight = 40
const containerHeight = 600
const overscan = 3
const delay = 150

export default function Home() {
  const [listItems, setListItems] = useState(items)
  const [scrollTop, setScrollTop] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect( () => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return
    
    const handleScroll = () => {
      const scrollTop = scrollElement.scrollTop

      setScrollTop(scrollTop)
    }

    handleScroll()

    scrollElement.addEventListener("scroll", handleScroll)

    return () => scrollElement.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return
    
    let timeoutId: number | null = null
    const handleScroll = () => {
      setIsScrolling(true)

      if (typeof timeoutId === 'number') {
        clearTimeout(timeoutId)
      }

      timeoutId = window.setTimeout(() => {
        setIsScrolling(false)
      }, delay)
    }

    scrollElement.addEventListener("scroll", handleScroll)

    return () => {
      if (typeof timeoutId === 'number') {
        clearTimeout(timeoutId)
      }
      scrollElement.removeEventListener("scroll", handleScroll)
    }
  }, [])

  const virtualList = useMemo(() => {
    let startRange = scrollTop
    let endRange = scrollTop + containerHeight

    let startIndex = Math.floor( startRange / itemHeight)
    let endIndex = Math.ceil( endRange / itemHeight)

    startIndex = Math.max(0, startIndex - overscan)
    endIndex = Math.min(items.length - 1, endIndex + overscan)

    const virtualList = []

    for (let index = startIndex; index <= endIndex; index++) {
      virtualList.push({
        index,
        offsetTop: index * itemHeight
      })
    }

    return virtualList
  }, [items.length, scrollTop])

  const totalListHeight = items.length * itemHeight

  return (
    <div style={{ padding: '0 12px' }}>
      <h1>Virtualized List</h1>
      <div style = {{marginBottom: 12}}>
        <button onClick = {() => setListItems((items) => items.slice().reverse())}>Reverse List</button>
      </div>
      <div style = {{height: containerHeight, overflow: 'auto', border: '1px solid lightgray', position: 'relative'}} ref = {scrollRef}>
        <div style = {{ height: totalListHeight}}>
          {virtualList.map((virtualItem, index) => {
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
                  {isScrolling ? 'Scrolling...' : item.text}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}