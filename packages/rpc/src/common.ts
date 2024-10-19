import 'reflect-metadata'
import { metadata } from './utils'

type Rv<T, R> = (x: T) => R

export interface Messenger {
	sendMessage(method: string, ...args: any[]): Promise<void>
	getMessages(): AsyncGenerator<{ method: string; args: any[] }>
}

export type MessengerClass<T extends Messenger = Messenger> = {
	new (...args: any[]): T
}

export type DirectOutput<T, Td> = {
	[K in keyof T]: T[K] extends (...args: infer Args) => infer R
		? // If the return type is the one we're looking for, return it directly
			R extends Rv<Td, infer Rvt>
			? (...args: Args) => Rvt
			: T[K]
		: T[K] // For non-function properties, leave them unchanged
}

export type PromisedOutput<T, Td> = {
	[K in keyof T]: T[K] extends (...args: infer Args) => infer R
		? // If the return type is the one we're looking for, wrap it in a Promise ...
			R extends Rv<Td, infer Rvt>
			? Rvt extends Promise<any>
				? (...args: Args) => Rvt // ... only if not a Promise already
				: (...args: Args) => Promise<Rvt>
			: T[K]
		: T[K] // For non-function properties, leave them unchanged
}

export class Side<S extends Messenger> {
	constructor(public ctr: MessengerClass<S>) {}

	define<R>(): Rv<S, R> {
		throw new SideReturnError('RPC descriptor function', this)
	}
}
class SideReturnError extends Error {
	constructor(
		message: string,
		public side: Side<any>
	) {
		super(message)
	}
}
export function sided<T extends Messenger>(sideClass: MessengerClass<T>) {
	return function sidedDecorator(
		target: T,
		propertyKey: string,
		descriptor: TypedPropertyDescriptor<any>
	) {
		const original = descriptor.value
		descriptor.value = function (...args: any[]) {
			let side: Side<any> | null = null
			try {
				original.apply(this, args)
			} catch (e) {
				if (!(e instanceof SideReturnError)) throw e
				side = e.side
			}
			if (!side)
				throw new Error(
					'no side class - `@sided` functions should return `Side<>.seturn<...>(...)`'
				)
		}
		const sides = metadata('cls:sides', target, {
			sides: new Map<MessengerClass, string[]>()
		}).sides!

		if (!sides.get(sideClass)) sides.set(sideClass, [])
		sides.get(sideClass)!.push(propertyKey)
		return descriptor
	}
}

function implementsFor<T extends Messenger>(target: MessengerClass<T>) {
	const rv = class extends target {}
	const sides = metadata('cls:sides', target, { sides: new Map<MessengerClass, string[]>() }).sides!
	for (const [side, functions] of sides)
		if (side !== target)
			for (const fn of functions) // TODO
				rv.prototype[fn] = function (...args: any[]) {}
	for (const fn of sides.get(target) ?? [])
		rv.prototype[fn] = function () {
			throw Error(`Not overridden: ${target.name} implementation does not override ${fn}`)
		}
	return rv
}
