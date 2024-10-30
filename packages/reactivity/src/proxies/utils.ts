import {
	ArrayIndexRange,
	ArrayTransaction,
	ContentObject,
	OrderedReactiveHandlers,
	PropertyTransaction,
	ReactiveHandler,
	Transaction
} from '../types'

const forSet = <Obj extends ContentObject>(handlers: OrderedReactiveHandlers<Obj>) => [
		...handlers.setFirst,
		...handlers.any,
		...handlers.getFirst
	],
	forGet = <Obj extends ContentObject>(handlers: OrderedReactiveHandlers<Obj>) => [
		...handlers.getFirst,
		...handlers.any,
		...handlers.setFirst
	]

function chainHandlers<Obj extends ContentObject>(
	handlers: ReactiveHandler<Obj>[],
	transaction: Transaction<Obj>,
	...calls: (keyof ReactiveHandler<Obj>)[]
) {
	for (const handler of handlers)
		for (const call of calls) if (handler?.[call]?.(transaction as any) === false) return false
	return true
}

export function chainGetHandlers<Obj extends ContentObject>(
	handlers: OrderedReactiveHandlers<Obj>,
	transaction: Transaction<Obj>,
	...calls: (keyof ReactiveHandler<Obj>)[]
) {
	if (chainHandlers(forGet(handlers), transaction, 'consult', ...calls)) return transaction
}

export function chainSetHandlers<Obj extends ContentObject>(
	handlers: OrderedReactiveHandlers<Obj>,
	transaction: Transaction<Obj>,
	...calls: (keyof ReactiveHandler<Obj>)[]
) {
	if (chainHandlers(forSet(handlers), transaction, ...calls)) return transaction
}

/**
 * Specifies a range of indexes for the array
 * @param array Only the length of this array will be used if an index is negative
 * @param start
 * @param length
 * @returns
 */
export function aIRangeSL(array: any[], start: number, length: number = 1) {
	return new ArrayIndexRange({ start, length }, array.length)
}

/**
 * Specifies a range of indexes for the array.
 * If no other argument than the array is given, the whole array will be specified - if only the start, the end
 * 	(from the `start` argument) will be used
 * @param array Only the length of this array will be used if an index is negative
 * @param start
 * @param end Defaults to `array.length`
 * @returns
 */
export function aIRangeSE(array: any[], start: number = 0, end?: number) {
	return new ArrayIndexRange({ start, end: end ?? array.length }, array.length)
}

export const tProp = <Obj extends ContentObject>(
	target: Obj,
	propertyKey: PropertyKey,
	value?: any
): PropertyTransaction<Obj> => ({ type: 'property', target, propertyKey, ...(value && { value }) })

export const tArray = <Items = any, Obj extends Items[] = Items[]>(
	target: Obj,
	indexes?: ArrayIndexRange | { start: number; length?: number; end?: number },
	value?: Items
): ArrayTransaction<Items, Obj> => ({
	type: 'array',
	target,
	indexes: !indexes
		? aIRangeSE(target)
		: indexes instanceof ArrayIndexRange
			? indexes
			: new ArrayIndexRange(indexes),
	...(value && { value })
})
