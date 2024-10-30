import { Constructor } from '~/types'
import { ArrayIndexRange, ContentObject, ProxyHandlers } from '../types'
import { aIRangeSE, aIRangeSL, chainGetHandlers, chainSetHandlers, tArray, tProp } from './utils'
import { array } from '~/type/src'
// TODO Take also ALL the reading operations. Array.indexOf has to be caught to say we listen to the whole array
//    ... Oh ... and Array.length too ...
// TODO Writing operations should at least indicate the modified index

type NativeDescriptor<Obj extends ContentObject = ContentObject> = {
	natives: Constructor<Obj>[]
	transactions: Record<
		string,
		(this: ProxyHandlers<Obj>, native: (...args: any) => any, ...args: any[]) => any
	>
}

function dateModification(
	this: ProxyHandlers<Date>,
	native: (...args: any) => any,
	...args: any[]
) {
	const { target, handlers } = this,
		modification = {
			type: 'date',
			target,
			value: Reflect.apply(native, new Date(target.getTime()), args)
		}
	if (chainSetHandlers(handlers, modification, 'alterDate'))
		return Reflect.apply(native, target, args)
}
function dateConsultation(
	this: ProxyHandlers<Date>,
	native: (...args: any) => any,
	...args: any[]
) {
	const { target, handlers } = this,
		consultation = {
			type: 'date',
			target,
			value: Reflect.apply(native, target, args)
		}
	chainGetHandlers(handlers, consultation, 'readDate')
	return consultation.value
}
function newLength(handlers: ProxyHandlers<Array<any>>, length: number) {
	const { target, handlers: targetHandlers } = handlers
	return chainSetHandlers(targetHandlers, tProp(target, 'length', length), 'set')
}
function wholeArrayConsultation(
	this: ProxyHandlers<Array<any>>,
	native: (...args: any) => any,
	...args: any[]
) {
	const { target, handlers } = this
	chainGetHandlers(handlers, tArray(target), 'arraySlice')
	return Reflect.apply(native, target, args)
}

function standard(
	transaction: (this: ProxyHandlers<any>, native: (...args: any) => any, ...args: any[]) => any,
	...functions: PropertyKey[]
) {
	return Object.fromEntries(functions.map((name) => [name, transaction]))
}
export const nativeTransactions: NativeDescriptor<any>[] = [
	{
		natives: [Date],
		transactions: {
			...standard(
				dateModification,
				'setTime',
				'setFullYear',
				'setMonth',
				'setDate',
				'setHours',
				'setMinutes',
				'setSeconds',
				'setMilliseconds',
				'setUTCFullYear',
				'setUTCMonth',
				'setUTCDate',
				'setUTCHours',
				'setUTCMinutes',
				'setUTCSeconds',
				'setUTCMilliseconds'
			),
			...standard(
				dateConsultation,
				'getTime',
				'getFullYear',
				'getMonth',
				'getDate',
				'getHours',
				'getMinutes',
				'getSeconds',
				'getMilliseconds',
				'getUTCFullYear',
				'getUTCMonth',
				'getUTCDate',
				'getUTCHours',
				'getUTCMinutes',
				'getUTCSeconds',
				'getUTCMilliseconds'
			)
		}
	},
	{
		natives: [Array],
		transactions: {
			// #region modifications

			push(native: (...args: any) => any, ...args: any[]) {
				const { target, handlers } = this
				if (
					chainSetHandlers(
						handlers,
						tArray(target, { start: target.length, length: args.length }, args),
						'arrayPush'
					) &&
					newLength(this, target.length + args.length)
				)
					return Reflect.apply(native, target, args)
			},
			pop(native: (...args: any) => any) {
				const { target, handlers } = this
				if (!target.length) return
				if (
					chainSetHandlers(handlers, tArray(target, aIRangeSE(target, -1)), 'arrayPop') &&
					newLength(this, target.length - 1)
				)
					return chainGetHandlers(
						handlers,
						tProp(target, target.length - 1, Reflect.apply(native, target, [])),
						'get'
					)?.value
			},
			unshift(native: (...args: any) => any, ...args: any[]) {
				const { target, handlers } = this
				if (
					chainSetHandlers(handlers, tArray(target, aIRangeSE(target)), 'arrayUnshift') &&
					newLength(this, target.length + args.length)
				)
					return Reflect.apply(native, target, args)
			},
			shift(native: (...args: any) => any) {
				const { target, handlers } = this
				if (!target.length) return
				if (
					chainSetHandlers(handlers, tArray(target, aIRangeSE(target)), 'arrayShift') &&
					newLength(this, target.length - 1)
				)
					return chainGetHandlers(
						handlers,
						tProp(target, 0, Reflect.apply(native, target, [])),
						'get'
					)?.value
			},

			splice(
				native: (...args: any) => any,
				start: number,
				deleteCount: number = Infinity,
				...args: any[]
			) {
				if ([0, undefined].includes(deleteCount)) return
				const { target, handlers } = this,
					indexes = aIRangeSL(target, start, deleteCount)
				if (
					chainSetHandlers(
						handlers,
						tArray(
							target,
							// If the size of the removed part is not the same as the size of the arguments,
							//  The whole end of the array will be modified
							indexes.length === args.length ? indexes : aIRangeSE(target, start)
						),
						'arraySplice'
					) &&
					(indexes.length === args.length ||
						newLength(this, target.length - indexes.length + args.length))
				)
					return chainGetHandlers(
						handlers,
						tArray(target, indexes),
						Reflect.apply(native, target, [start, deleteCount, ...args]),
						'arraySlice'
					)?.value
			},
			fill(native: (...args: any) => any, value: any, start?: number, end?: number) {
				const { target, handlers } = this,
					indexes = aIRangeSE(target, start, end)
				if (!indexes.length) return
				const modification = tArray(target, indexes, value)
				if (chainSetHandlers(handlers, modification, 'arrayFill'))
					return Reflect.apply(native, target, [modification.value, start, end])
			},
			copyWithin(native: (...args: any) => any, towards: number, start: number, end?: number) {
				const { target, handlers } = this,
					sourceIndexes = aIRangeSE(target, start, end),
					targetIndexes = aIRangeSL(target, towards, sourceIndexes.length)
				sourceIndexes.length = targetIndexes.length
				if (!sourceIndexes.length) return
				if (chainSetHandlers(handlers, tArray(target, targetIndexes), 'arrayCopyWithin')) {
					chainGetHandlers(handlers, tArray(target, sourceIndexes), 'arraySlice')
					return Reflect.apply(native, target, [towards, start, end])
				}
			},
			reverse(native: (...args: any) => any) {
				const { target, handlers } = this
				if (chainSetHandlers(handlers, tArray(target, aIRangeSE(target)), 'arrayReverse'))
					return Reflect.apply(native, target, [])
			},
			sort(native: (...args: any) => any, compareFn?: (a: any, b: any) => number) {
				const { target, handlers } = this
				if (chainSetHandlers(handlers, tArray(target, aIRangeSE(target)), 'arraySort'))
					return Reflect.apply(native, target, [compareFn])
			},

			// #endregion
			// #region consultation
			...standard(
				wholeArrayConsultation,
				'flat',
				'flatMap',
				'forEach',
				'join',
				'map',
				'reduce',
				'reduceRight',
				'toString',
				'toLocaleString',
				'toReversed',
				'toSorted',
				'values',
				Symbol.iterator
			),
			at(native: (...args: any) => any, index: number) {
				const { target, handlers } = this,
					indexes = aIRangeSL(target, index)
				chainGetHandlers(
					handlers,
					tProp(target, indexes.start, Reflect.apply(native, target, [index])),
					'get'
				)?.value
			},
			concat(native: (...args: any) => any, ...others: any[]) {
				const { target, handlers } = this
				// Note: we consider all the arrays have the same handlers - it should generally be the case
				return Reflect.apply(
					native,
					[],
					[target, ...others].map((array) =>
						chainGetHandlers(handlers, tArray(array), 'arraySlice') ? array : []
					)
				)
			},
			entries(native: (...args: any) => any) {
				const { target, handlers } = this
				if (chainGetHandlers(handlers, tArray(target), 'arraySlice'))
					return Reflect.apply(native, target, [])
			},
			every(_, predicate: (value: any, index: number) => boolean) {
				const { target, handlers } = this,
					failingIndex = target.findIndex((value, index) => !predicate(value, index))
				if (failingIndex === -1) {
					chainGetHandlers(handlers, tArray(target), 'arraySlice')
					return true
				}
				chainGetHandlers(handlers, tProp(target, failingIndex), 'get')
				return false
			},
			some(_, predicate: (value: any, index: number) => boolean) {
				const { target, handlers } = this,
					succeedingIndex = target.findIndex((value, index) => predicate(value, index))
				if (succeedingIndex === -1) {
					chainGetHandlers(handlers, tArray(target), 'arraySlice')
					return false
				}
				chainGetHandlers(handlers, tProp(target, succeedingIndex), 'get')
				return true
			},
			filter(native: (...args: any) => any, predicate: (value: any, index: number) => boolean) {
				const { target, handlers } = this
				if (chainGetHandlers(handlers, tArray(target), 'arraySlice'))
					return Reflect.apply(native, target, [predicate])
			},
			find(_, predicate: (value: any, index: number) => boolean) {
				const { target, handlers } = this,
					index = target.findIndex(predicate)
				if (index >= 0) {
					chainGetHandlers(handlers, tArray(target, aIRangeSL(target, 0, index)), 'arraySlice')
					return target[index]
				}
				chainGetHandlers(handlers, tArray(target), 'arraySlice')
			},
			findIndex(native: (...args: any) => any, predicate: (value: any, index: number) => boolean) {
				const { target, handlers } = this,
					index = Reflect.apply(native, target, [predicate])
				if (index >= 0) {
					chainGetHandlers(handlers, tArray(target, aIRangeSL(target, 0, index)), 'arraySlice')
					return index
				}
				chainGetHandlers(handlers, tArray(target), 'arraySlice')
				return -1
			},
			findLast(_, predicate: (value: any, index: number) => boolean) {
				const { target, handlers } = this,
					index = target.findLastIndex(predicate)
				if (index >= 0) {
					chainGetHandlers(handlers, tArray(target, aIRangeSE(target, index)), 'arraySlice')
					return target[index]
				}
				chainGetHandlers(handlers, tArray(target), 'arraySlice')
			},
			findLastIndex(
				native: (...args: any) => any,
				predicate: (value: any, index: number) => boolean
			) {
				const { target, handlers } = this,
					index = Reflect.apply(native, target, [predicate])
				if (index >= 0) {
					chainGetHandlers(handlers, tArray(target, aIRangeSE(target, index)), 'arraySlice')
					return index
				}
				chainGetHandlers(handlers, tArray(target), 'arraySlice')
				return -1
			},
			includes(_, value: any) {
				const { target, handlers } = this,
					index = target.indexOf(value)
				if (index >= 0) {
					chainGetHandlers(handlers, tArray(target, aIRangeSL(target, 0, index)), 'arraySlice')
					return true
				}
				chainGetHandlers(handlers, tArray(target), 'arraySlice')
				return false
			},
			indexOf(_, value: any) {
				const { target, handlers } = this,
					index = target.indexOf(value)
				chainGetHandlers(
					handlers,
					tArray(target, aIRangeSL(target, 0, index > 0 ? index : target.length)),
					'arraySlice'
				)
				return index
			},
			lastIndexOf(_, value: any) {
				const { target, handlers } = this,
					index = target.lastIndexOf(value)
				chainGetHandlers(
					handlers,
					tArray(target, aIRangeSE(target, index > 0 ? index : target.length - 1)),
					'arraySlice'
				)
				return index
			},
			keys(native: (...args: any) => any) {
				const { target, handlers } = this
				chainGetHandlers(handlers, tProp(target, 'length'), 'get')
				return Reflect.apply(native, target, [])
			},
			slice(native: (...args: any) => any, start: number, end: number) {
				const { target, handlers } = this
				return chainGetHandlers(
					handlers,
					tArray(
						target,
						aIRangeSE(target, start, end),
						Reflect.apply(native, target, [start, end])
					),
					'arraySlice'
				)?.value
			},
			toSpliced(
				native: (...args: any) => any,
				start: number,
				deleteCount: number = Infinity,
				...args: any[]
			) {
				const { target, handlers } = this,
					indexes = aIRangeSL(target, start, deleteCount)
				if (indexes.length === 0) chainGetHandlers(handlers, tArray(target), 'arraySlice')
				else {
					if (indexes.start > 0)
						chainGetHandlers(
							handlers,
							tArray(target, aIRangeSL(target, 0, indexes.start)),
							'arraySlice'
						)
					if (indexes.end < target.length)
						chainGetHandlers(handlers, tArray(target, aIRangeSE(target, indexes.end)), 'arraySlice')
				}
				return Reflect.apply(native, target, [start, deleteCount, ...args])
			},
			with(native: (...args: any) => any, index: number, value: any) {
				const { target, handlers } = this
				if (index > 0)
					chainGetHandlers(handlers, tArray(target, aIRangeSL(target, 0, index)), 'arraySlice')
				if (index + 1 < target.length)
					chainGetHandlers(handlers, tArray(target, aIRangeSE(target, index + 1)), 'arraySlice')
				return Reflect.apply(native, target, [index, value])
			}

			// #endregion
		}
	} as NativeDescriptor<Array<any>>,
	{
		natives: [Set, WeakSet],
		transactions: {
			add(native: (...args: any) => any, value: any) {
				const { target, handlers } = this,
					modification = {
						type: 'set',
						target,
						value
					}
				if (chainSetHandlers(handlers, modification, 'setAdd'))
					return Reflect.apply(native, target, [modification.value])
			},
			delete(native: (...args: any) => any, value: any) {
				const { target, handlers } = this,
					modification = {
						type: 'set',
						target,
						value
					}
				if (chainSetHandlers(handlers, modification, 'setDelete'))
					return Reflect.apply(native, target, [modification.value])
			},
			clear(native: (...args: any) => any) {
				const { target, handlers } = this,
					modification = {
						type: 'set',
						target
					}
				if (chainSetHandlers(handlers, modification, 'setClear'))
					return Reflect.apply(native, target, [])
			},
			has(native: (...args: any) => any, value: any) {
				const { target, handlers } = this,
					modification = {
						type: 'set',
						target,
						value
					}
				if (chainGetHandlers(handlers, modification, 'setHas'))
					return Reflect.apply(native, target, [modification.value])
			}
		}
	},
	{
		natives: [Map, WeakMap],
		transactions: {
			set(native: (...args: any) => any, key: any, value: any) {
				const { target, handlers } = this,
					modification = {
						type: 'map',
						target,
						key,
						value
					}
				if (chainSetHandlers(handlers, modification, 'mapSet'))
					return Reflect.apply(native, target, [modification.key, modification.value])
			},
			delete(native: (...args: any) => any, key: any) {
				const { target, handlers } = this,
					modification = {
						type: 'map',
						target,
						key
					}
				if (chainSetHandlers(handlers, modification, 'mapDelete'))
					return Reflect.apply(native, target, [modification.key])
			},
			clear(native: (...args: any) => any) {
				const { target, handlers } = this,
					modification = {
						type: 'map',
						target
					}
				if (chainSetHandlers(handlers, modification, 'mapClear'))
					return Reflect.apply(native, target, [])
			},
			has(native: (...args: any) => any, key: any) {
				const { target, handlers } = this,
					modification = {
						type: 'map',
						target,
						key
					}
				if (chainGetHandlers(handlers, modification, 'mapHas'))
					return Reflect.apply(native, target, [modification.key])
			},
			get(native: (...args: any) => any, key: any) {
				const { target, handlers } = this,
					modification = {
						type: 'map',
						target,
						key,
						value: Reflect.apply(native, target, [key])
					}
				if (chainGetHandlers(handlers, modification, 'mapGet')) return modification.value
			}
		}
	},
	{
		/**
		 * All Int8Array, Float32Array, ... derive from one base class
		 *
		 * They should be handled in the same way and also than DataView
		 */
		natives: [Object.getPrototypeOf(Int8Array.prototype).constructor],
		transactions: {}
	}
]
