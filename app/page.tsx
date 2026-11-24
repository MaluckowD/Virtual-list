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

type Key = number | string

interface UseDynamicSizeGridProps {
	rowsCount: number
	columnsCount: number
	rowHeight?: (index: number) => number
	columnWidth: (index: number) => number
	getRowKey: (index: number) => Key
	getColumnKey: (index: number) => Key
	estimateRowHeight: (index: number) => number
	estimateColumnWidth?: (index: number) => number
	overscanY?: number
	overscanX?: number
	scrollingDelay?: number
	getScrollElement: () => HTMLElement | null
}

interface DynamicSizeGridRow {
	key: Key
	index: number
	offsetTop: number
	height: number
}

interface DynamicSizeGridColumn {
	key: Key
	index: number
	offsetLeft: number
	width: number
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
		columnsCount,
		rowHeight,
		columnWidth,
		overscanY = DEFAULT_OVERSCAN_Y,
		overscanX = DEFAULT_OVERSCAN_X,
		scrollingDelay = DEFAULT_SCROLLING_DELAY,
		getScrollElement,
		getRowKey,
		getColumnKey,
		estimateRowHeight,
		estimateColumnWidth
	} = props

	const [scrollTop, setScrollTop] = useState(0)
	const [scrollLeft, setScrollLeft] = useState(0)
	const [isScrolling, setIsScrolling] = useState(false)
	const [gridHeight, setGridHeight] = useState(0)
	const [gridWidth, setGridWidth] = useState(0)
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

			const size = entry.borderBoxSize[0]
				? {
						height: entry.borderBoxSize[0].blockSize,
						width: entry.borderBoxSize[0].inlineSize
					}
				: entry.target.getBoundingClientRect()

			setGridHeight(size.height)
			setGridWidth(size.width)
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
			const { scrollTop, scrollLeft } = scrollElement
			setScrollTop(scrollTop)
			setScrollLeft(scrollLeft)
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
	}, [getScrollElement, scrollingDelay])

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

	const {
		virtualColumns,
		columnStartIndex,
		columnEndIndex,
		totalGridWidth,
		allColumns
	} = useMemo(() => {
		let startRange = scrollLeft
		let endRange = scrollLeft + gridWidth

		let columnStartIndex = -1
		let columnEndIndex = -1
		let allColumns: DynamicSizeGridColumn[] = Array(columnsCount)
		let totalGridWidth = 0

		for (let index = 0; index < columnsCount; index++) {
			const key = getColumnKey(index)

			const column = {
				key,
				index,
				width: columnWidth(index),
				offsetLeft: totalGridWidth
			}

			totalGridWidth += column.width
			allColumns[index] = column

			if (column.width + column.offsetLeft < startRange) {
				columnStartIndex++
			}

			if (column.width + column.offsetLeft < endRange) {
				columnEndIndex++
			}
		}

		columnStartIndex = Math.max(0, columnStartIndex - overscanX)
		columnEndIndex = Math.min(columnEndIndex + overscanX, columnsCount - 1)

		const virtualColumns = allColumns.slice(
			columnStartIndex,
			columnEndIndex + 1
		)

		return {
			virtualColumns,
			columnStartIndex,
			columnEndIndex,
			totalGridWidth,
			allColumns
		}
	}, [
		scrollLeft,
		gridWidth,
		rowsCount,
		overscanX,
		gridHeight,
		getColumnKey,
		columnsCount,
		columnWidth
		// estimateColumnHeight,
		// measurementCache
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
		measureElement,
		virtualColumns,
		columnStartIndex,
		columnEndIndex,
		totalGridWidth,
		allColumns
	}
}

const gridSize = 100

const createItems = () => {
	return Array.from({ length: gridSize }, (_) => ({
		id: Math.random().toString(36).slice(2),
		columns: Array.from({ length: gridSize }, () => ({
			id: Math.random().toString(36).slice(2),
			text: faker.lorem.words({ min: 1, max: 4 })
		}))
	}))
}

const containerHeight = 600

export default function Home() {
	const [gridItems, setGridItems] = useState(createItems)
	const scrollRef = useRef<HTMLDivElement | null>(null)

	const {
		virtualRows,
		totalGridHeight,
		measureElement,
		totalGridWidth,
		virtualColumns
	} = useDynamicSizeGrid({
		rowsCount: gridSize,
		columnsCount: gridSize + 1,
		columnWidth: useCallback(() => 200, []),
		getColumnKey: useCallback((index) => index, []),
		getScrollElement: useCallback(() => scrollRef.current, []),
		getRowKey: useCallback((index) => gridItems[index].id, [gridItems]),
		estimateRowHeight: useCallback(() => 16, [])
	})

	const reverseGrid = () => {
		setGridItems((items) => {
			return items
				.map((item) => ({
					...item,
					columns: item.columns.slice().reverse()
				}))
				.reverse()
		})
	}

	return (
		<div style={{ padding: '0 12px' }}>
			<h1>Virtualized List</h1>
			<div style={{ marginBottom: 12 }}>
				<button onClick={reverseGrid}>Reverse List</button>
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
				<div style={{ height: totalGridHeight, width: totalGridWidth }}>
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
									transform: `translateY(${virtualRow.offsetTop}px)`,
									display: 'flex'
								}}
							>
								{virtualColumns.map((virtualColumn, index) => {
									const item =
										gridItems[virtualRow.index].columns[
											virtualColumn.index
										]

									return (
										<div
											key={item.id}
											style={{
												marginLeft:
													index === 0
														? virtualColumn.offsetLeft
														: 0,
												width: virtualColumn.width
											}}
										>
											{item.text}
										</div>
									)
								})}
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}
