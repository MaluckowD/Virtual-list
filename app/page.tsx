'use client'

import {
	useCallback,
	useEffect,
	useInsertionEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState
} from 'react'
import { faker } from '@faker-js/faker'

const items = Array.from({ length: 10_000 }, (_, i) => ({
	id: Math.random().toString(36).slice(2),
	text: faker.lorem.paragraphs({
		min: 3,
		max: 6
	})
}))

type Key = number | string

interface UseDynamicSizeGridProps {
	rowsCount: number
	rowHeight?: (index: number) => number
	getRowKey: (index: number) => Key
	estimateRowHeight: (index: number) => number
	overscanY?: number
	scrollingDelay?: number
	getScrollElement: () => HTMLElement | null
}

interface DynamicSizeGridRow {
	key: Key
	index: number
	offsetTop: number
	height: number
}

const DEFAULT_OVERSCAN_Y = 3
const DEFAULT_OVERSCAN_X = 1
const DEFAULT_SCROLLING_DELAY = 150

const validateProps = (props: UseDynamicSizeGridProps) => {
	const { rowHeight, estimateRowHeight } = props

	if (!rowHeight && !estimateRowHeight) {
		throw new Error(
			`you must pass either "itemHeight" or "estimateRowHeight" prop`
		)
	}
}

function useLatest<T>(value: T) {
	const valueRef = useRef(value)
	useInsertionEffect(() => {
		valueRef.current = value
	})
	return valueRef
}

function useDynamicSizeGrid(props: UseDynamicSizeGridProps) {
	validateProps(props)
	const {
		rowsCount,
		rowHeight,
		overscanY = DEFAULT_OVERSCAN_Y,
		scrollingDelay = DEFAULT_SCROLLING_DELAY,
		getScrollElement,
		getRowKey,
		estimateRowHeight
	} = props

	const [scrollTop, setScrollTop] = useState(0)
	const [isScrolling, setIsScrolling] = useState(false)
	const [gridHeight, setListHeight] = useState(0)
	const [measurementCache, setMeasurementCache] = useState<
		Record<Key, number>
	>({})

	useLayoutEffect(() => {
		const scrollElement = getScrollElement()

		if (!scrollElement) {
			return
		}

		const resizeObserver = new ResizeObserver(([entry]) => {
			if (!entry) {
				return
			}

			const height =
				entry.borderBoxSize[0]?.blockSize ??
				entry.target.getBoundingClientRect().height
			setListHeight(height)
		})

		resizeObserver.observe(scrollElement)

		return () => {
			resizeObserver.disconnect()
		}
	}, [getScrollElement])

	useLayoutEffect(() => {
		const scrollElement = getScrollElement()
		if (!scrollElement) {
			return
		}

		const handleScroll = () => {
			const scrollTop = scrollElement.scrollTop

			setScrollTop(scrollTop)
		}

		handleScroll()

		scrollElement.addEventListener('scroll', handleScroll)

		return () => scrollElement.removeEventListener('scroll', handleScroll)
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

		scrollElement.addEventListener('scroll', handleScroll)

		return () => {
			if (typeof timeoutId === 'number') {
				clearTimeout(timeoutId)
			}
			scrollElement.removeEventListener('scroll', handleScroll)
		}
	}, [getScrollElement])

	const {
		virtualRows,
		rowStartIndex,
		rowEndIndex,
		totalGridHeight,
		allRows
	} = useMemo(() => {
		const getRowHeight = (index: number) => {
			if (rowHeight) {
				return rowHeight(index)
			}

			const key = getRowKey(index)

			if (typeof measurementCache[key] === 'number') {
				return measurementCache[key]
			}

			return estimateRowHeight(index)
		}

		let startRange = scrollTop
		let endRange = scrollTop + gridHeight

		let rowStartIndex = -1
		let rowEndIndex = -1
		let allRows: DynamicSizeGridRow[] = Array(rowsCount)
		let totalGridHeight = 0

		for (let index = 0; index < rowsCount; index++) {
			const key = getRowKey(index)

			const row = {
				key,
				index,
				height: getRowHeight(index),
				offsetTop: totalGridHeight
			}

			totalGridHeight += row.height
			allRows[index] = row

			if (row.height + row.offsetTop < startRange) {
				rowStartIndex++
			}

			if (row.height + row.offsetTop < endRange) {
				rowEndIndex++
			}
		}

		rowStartIndex = Math.max(0, rowStartIndex - overscanY)
		rowEndIndex = Math.min(rowEndIndex + overscanY, rowsCount - 1)

		const virtualRows = allRows.slice(rowStartIndex, rowEndIndex + 1)

		return {
			virtualRows,
			rowStartIndex,
			rowEndIndex,
			totalGridHeight,
			allRows
		}
	}, [
		scrollTop,
		gridHeight,
		rowsCount,
		overscanY,
		rowHeight,
		getRowKey,
		estimateRowHeight,
		measurementCache
	])

	const latestData = useLatest({
		measurementCache,
		getRowKey,
		allRows,
		getScrollElement,
		scrollTop
	})

	const measureElementsInner = useCallback(
		(
			element: Element | null,
			resizeObserver: ResizeObserver,
			entry?: ResizeObserverEntry
		) => {
			if (!element) {
				return
			}

			if (!element.isConnected) {
				resizeObserver.unobserve(element)
				return
			}

			const indexAttribute = element.getAttribute('data-index') || ''
			const index = parseInt(indexAttribute, 10)

			if (isNaN(index)) {
				console.error(
					'dynamic elements must have a valid `data-index` attribute'
				)
				return
			}

			const {
				measurementCache,
				getRowKey,
				allRows,
				getScrollElement,
				scrollTop
			} = latestData.current
			const key = getRowKey(index)
			const isResize = Boolean(entry)

			resizeObserver.observe(element)

			if (!isResize && typeof measurementCache[key] === 'number') {
				return
			}

			const height =
				entry?.borderBoxSize[0].blockSize ??
				element.getBoundingClientRect().height

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
				...cache,
				[key]: height
			}))
		},
		[]
	)

	const rowsResizeObserver = useMemo(() => {
		if (typeof ResizeObserver === 'undefined') return
		const ro = new ResizeObserver((entries) => {
			entries.forEach((entry) => {
				measureElementsInner(entry.target, ro, entry)
			})
		})

		return ro
	}, [latestData])

	const measureElement = useCallback(
		(element: Element | null) => {
			if (!rowsResizeObserver) return
			measureElementsInner(element, rowsResizeObserver)
		},
		[rowsResizeObserver]
	)

	return {
		virtualRows,
		rowStartIndex,
		rowEndIndex,
		isScrolling,
		totalGridHeight,
		gridHeight,
		allRows,
		measureElement
	}
}

const containerHeight = 600

export default function Home() {
	const [gridItems, setGridItems] = useState(items)
	const scrollRef = useRef<HTMLDivElement | null>(null)

	const { virtualRows, totalGridHeight, measureElement } = useDynamicSizeGrid(
		{
			rowsCount: gridItems.length,
			// itemHeight: () => 40 + Math.round(10 * Math.random()),
			getScrollElement: useCallback(() => scrollRef.current, []),
			getRowKey: useCallback((index) => gridItems[index].id, [gridItems]),
			estimateRowHeight: useCallback(() => 16, [])
		}
	)

	return (
		<div style={{ padding: '0 12px' }}>
			<h1>Virtualized List</h1>
			<div style={{ marginBottom: 12 }}>
				<button
					onClick={() =>
						setGridItems((items) => items.slice().reverse())
					}
				>
					Reverse List
				</button>
			</div>
			<div
				style={{
					height: containerHeight,
					overflow: 'auto',
					border: '1px solid lightgray',
					position: 'relative'
				}}
				ref={scrollRef}
			>
				<div style={{ height: totalGridHeight }}>
					{virtualRows.map((virtualRow, index) => {
						const item = gridItems[virtualRow.index]
						return (
							<div
								key={item.id}
								data-index={virtualRow.index}
								ref={measureElement}
								style={{
									padding: '6px 12px',
									position: 'absolute',
									top: 0,
									transform: `translateY(${virtualRow.offsetTop}px)`
								}}
							>
								{virtualRow.index} - {item.text}
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}
