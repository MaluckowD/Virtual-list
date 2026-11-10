'use client'

import { useCallback, useEffect, useInsertionEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { faker } from '@faker-js/faker';

const items = Array.from({ length: 10_000}, (_, i) => ({
  id: Math.random().toString(36).slice(2),
  text: faker.lorem.text(),
}));

type Key = number | string

interface UseFixedSizeListProps {
  itemsCount: number;
  itemHeight?: (index: number) => number;
  getItemKey: (index: number) => Key;
  estimateItemHeight: (index: number) => number;
  overscan?: number;
  scrollingDelay?: number;
  getScrollElement: () => HTMLElement | null;
}

const DEFAULT_OVERSCAN = 3
const DEFAULT_SCROLLING_DELAY = 150

const validateProps = (props: UseFixedSizeListProps) => {
  const {itemHeight, estimateItemHeight} = props

  if (!itemHeight && !estimateItemHeight) {
    throw new Error(`you must pass either "itemHeight" or "estimateItemHeight" prop`)
  }
}

function useLatest<T>(value: T) {
  const valueRef = useRef(value)
  useInsertionEffect(() => {
    valueRef.current = value
  })
  return valueRef
}
 
function useFixedSizeList(props: UseFixedSizeListProps) {
  validateProps(props)
    const {
    itemsCount,
    itemHeight,
    overscan = DEFAULT_OVERSCAN,
    scrollingDelay = DEFAULT_SCROLLING_DELAY,
    getScrollElement,
    getItemKey,
    estimateItemHeight
  } = props

  const [scrollTop, setScrollTop] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  const [listHeight, setListHeight] = useState(0)
  const [measurementCache, setMeasurementCache] = useState<Record<Key, number>>({})

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
    if (!scrollElement) {
      return
    }
    
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
    if (!scrollElement) {
      return
    }
    
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

  const { virtualItems, startIndex, endIndex, totalListHeight, allRows } = useMemo(() => {
    const getItemHeight = (index: number) => {
      if (itemHeight) {
        return itemHeight(index)
      }

      const key = getItemKey(index)

      if (typeof measurementCache[key] === 'number') {
        return measurementCache[key]
      }

      return estimateItemHeight(index)
    }

    let startRange = scrollTop
    let endRange = scrollTop + listHeight

    let startIndex = -1
    let endIndex = -1
    let allRows = Array(itemsCount)
    let totalListHeight = 0

    for (let index = 0; index < itemsCount; index++) {
      const key = getItemKey(index)

      const row = {
        key,
        index,
        height: getItemHeight(index),
        offsetTop: totalListHeight
      }

      totalListHeight += row.height
      allRows[index] = row

      if (startIndex === -1 && row.height + row.offsetTop > startRange) {
        startIndex = Math.max(0, index - overscan)
      }

      if (endIndex === -1 && row.height + row.offsetTop >= endRange ) {
        endIndex = Math.min(index + overscan, itemsCount - 1)
      }

    }

    const virtualItems = allRows.slice(startIndex, endIndex + 1)

    return { virtualItems, startIndex, endIndex, totalListHeight, allRows}
  }, [scrollTop, listHeight, itemsCount, overscan, itemHeight, getItemKey, 
    estimateItemHeight, measurementCache])

  
  const latestData = useLatest({measurementCache, getItemKey, allRows, getScrollElement, scrollTop})

  const itemsResizeObserver = useMemo(() => {
    const ro = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const element = entry.target

        if (!element.isConnected) {
          ro.unobserve(element)
          return
        }
  
        const indexAttribute = element.getAttribute("data-index") || ""
        const index = parseInt(indexAttribute, 10)

        if (isNaN(index)) {
          console.error("dynamic elements must have a valid `data-index` attribute")
          return
        }

        const { measurementCache, getItemKey, allRows, getScrollElement, scrollTop } = latestData.current
        const key = getItemKey(index)

        const height = entry.borderBoxSize[0].blockSize ?? element.getBoundingClientRect().height;

        if (measurementCache[key] === height) {
          return
        }
        
        const delta = height - allRows[index].height
        const item = allRows[index]

        if (delta !== 0 && scrollTop > item.offsetTop) {
          const element = getScrollElement()
          if (element) {
            element.scrollBy(0, delta)
          }
        }

        setMeasurementCache((cache) => ({
          ...cache, [key]: height
        }))

      })
    })

    return ro

  }, [])

  const measureElement = useCallback((element: Element | null) => {
    if (!element) {
      return
    }

    const indexAttribute = element.getAttribute("data-index") || ""
    const index = parseInt(indexAttribute, 10)

    if (isNaN(index)) {
      console.error("dynamic elements must have a valid `data-index` attribute")
      return
    }

    const { measurementCache, getItemKey, allRows, getScrollElement, scrollTop} = latestData.current
    const key = getItemKey(index)
    itemsResizeObserver.observe(element)

    if (typeof measurementCache[key] === 'number') {
      return
    }

    const size = element.getBoundingClientRect();

    const item = allRows[index]
    const delta = size.height - allRows[index].height

    if (delta !== 0 && scrollTop > item.offsetTop) {
      const element = getScrollElement()
      if (element) {
        element.scrollBy(0, delta)
      }
    }

    setMeasurementCache((cache) => ({
      ...cache, [key]: size.height
    }))

  }, [getItemKey, itemsResizeObserver])

  return {
    virtualItems,
    startIndex,
    endIndex,
    isScrolling,
    totalListHeight,
    listHeight,
    allRows,
    measureElement
  }
}
                                                
const containerHeight = 600

export default function Home() {
  const [listItems, setListItems] = useState(items)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const { virtualItems, totalListHeight, measureElement } = useFixedSizeList({
    itemsCount: listItems.length,
    // itemHeight: () => 40 + Math.round(10 * Math.random()),
    getScrollElement: useCallback(() => scrollRef.current, [] ),
    getItemKey: useCallback((index) => listItems[index].id, [listItems] ),
    estimateItemHeight: useCallback(() => 16, [])
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
                  data-index = {virtualItem.index}
                  ref = {measureElement}
                  style = {{ 
                    padding: '6px 12px',
                    position: 'absolute',
                    top: 0,
                    transform: `translateY(${virtualItem.offsetTop}px)`
                  }} 
                >
                  {item.id} - {item.text}
                </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}  
