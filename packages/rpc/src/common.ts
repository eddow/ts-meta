import 'reflect-metadata'
import { metadata, Constructor, PropertiesOf } from './utils'

type Rv<T, R> = (x: T) => R

export interface Messenger {
	sendMessage(method: string, ...args: any[]): Promise<void>
	getMessages(): AsyncGenerator<{ method: string; args: any[] }>
}

/**
 * Removes all properties that are `never`
 */
type NoNever<T> = Pick<
	T,
	{
		[K in keyof T]: T[K] extends never ? never : K
	}[keyof T]
>

/**
 * Takes a `transferable` class (who has sided functions) and returns a `sided` class - whose same-sided methods
 * return the specified type and others return a promise
 */
export type SidedOutput<T, Td> = NoNever<{
	[K in keyof T]: T[K] extends (...args: infer Args) => infer R
		? R extends Rv<Td, infer Rvt>
			? /* If the return type is the one we're implementing, DON'T specify it, it would make an 'instance member property'
				and avoid the declaration of an 'instance member function'
				*/ /*Rvt extends object
				? (...args: Args) => SidedOutput<Rvt, Td>
				: (...args: Args) => Rvt*/
				never
			: R extends Rv<any, infer Rvt>
				? // If the return type is not the one we're implementing, wrap it in a Promise ...
					Rvt extends Promise<infer Promised>
					? Promised extends object
						? (...args: Args) => Promise<SidedOutput<Promised, Td>>
						: (...args: Args) => Rvt
					: Rvt extends object
						? (...args: Args) => Promise<SidedOutput<Rvt, Td>> // ... only if not a Promise already
						: (...args: Args) => Promise<Rvt>
				: T[K]
		: T[K] // For non-function properties, leave them unchanged
}>

/*export function transferable<S, TBase extends Constructor = Constructor>(Base: TBase) {
	return class Transferable extends Base {*/
class Transferable {
	constructor() {}

	createInstance<T extends Transferable>(target: Constructor<T>, values: PropertiesOf<T>): T {
		return Object.assign(new target(), values)
	}
}

export class Side<S extends string> {
	constructor(public readonly name: string) {}

	// Will be used and called for
	define<R>(): Rv<S, R> {
		throw new SideReturnError('RPC descriptor function', this)
	}

	implement<T extends object>(target: Constructor<T>) {
		const rv = class extends Transferable {}
		const sides = metadata('cls:sides', target, {
			sides: new Map<Constructor, string[]>()
		}).sides!
		const prototype = <Record<string, any>>rv.prototype
		for (const [side, functions] of sides)
			if (side !== target)
				for (const fn of functions) // TODO
					prototype[fn] = function (...args: any[]) {}
		for (const fn of sides.get(target) ?? [])
			prototype[fn] = function () {
				throw Error(`The ${target.name} implementation of ${target.name} does not override ${fn}`)
			}
		return <Constructor<SidedOutput<T, S> & Transferable>>(<unknown>rv)
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

export function sided<T>(sideName: string) {
	return function sidedDecorator(
		target: object,
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
					'no side class - `@sided` functions should return `Side<>.define<...>(...)`'
				)
		}
		const sides = metadata('cls:sides', target, {
			sides: <Record<string, string[]>>{}
		}).sides!

		sides[sideName] ??= []
		sides[sideName].push(propertyKey)
		return descriptor
	}
}
