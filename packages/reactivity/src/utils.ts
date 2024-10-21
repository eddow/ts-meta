/**
 * Always a (new) promise: once resolved, can be waited again
 * Also, `resolve` and `reject` are exposed
 */
export class PromiseSequence<T = any> implements Promise<T> {
	private actualPromise: {
		resolve: (value: T | PromiseLike<T>) => void
		reject: (reason?: any) => void
		promise: Promise<T>
	}
	resolve(value: T | PromiseLike<T>) {
		return this.actualPromise.resolve(value)
	}
	reject(reason?: any) {
		return this.actualPromise.reject(reason)
	}

	private createPromise() {
		let resolve: (value: T | PromiseLike<T>) => void
		let reject: (reason?: any) => void
		const promise = new Promise<T>((_resolve, _reject) => {
			resolve = _resolve
			reject = _reject
		}).then((x) => {
			this.actualPromise = this.createPromise()
			return x
		})
		return { resolve: resolve!, reject: reject!, promise }
	}
	constructor() {
		// we have to c/p to avoid "not initialized" error
		this.actualPromise = this.createPromise()
	}
	readonly [Symbol.toStringTag]: string = 'PromiseSequence'
	then<TResult1 = T, TResult2 = never>(
		onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
	): Promise<TResult1 | TResult2> {
		return this.actualPromise.promise.then(onfulfilled, onrejected)
	}
	catch<TResult = never>(
		onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined
	): Promise<T | TResult> {
		return this.actualPromise.promise.catch(onrejected)
	}
	finally(onfinally?: (() => void) | null | undefined): Promise<T> {
		return this.actualPromise.promise.finally(onfinally)
	}
}

export class ContextStack<T> {
	private readonly stack: T[] = []
	get current() {
		return this.stack[0]
	}
	get isEmpty() {
		return this.stack.length === 0
	}
	enter(value: any) {
		this.stack.unshift(value)
	}
	leave() {
		return this.stack.shift()
	}
	with<R>(context: T, fn: (context: T) => R): R {
		this.enter(context)
		try {
			return fn(context)
		} finally {
			this.leave()
		}
	}
}

export function mapDefault<K, V>(
	map: Map<K, V> | (K extends WeakKey ? WeakMap<K, V> : never),
	key: K,
	defaultValue: () => V
): V {
	if (!map.has(key)) map.set(key, defaultValue())
	return map.get(key)!
}

export default class Defer {
	public promise: Promise<void> = Promise.resolve()
	private rejecter?: (reason?: any) => void
	private resolver?: (value?: any) => void
	timeout: any
	private internalCB?: () => Promise<void>

	constructor(
		private cb?: () => Promise<void> | void,
		public delay: number = 0
	) {}

	defer(cb?: () => Promise<void>) {
		if (cb) this.cb = cb
		if (this.timeout) clearTimeout(this.timeout)
		else {
			this.promise = new Promise<void>((resolve, reject) => {
				this.resolver = resolve
				this.rejecter = reject
			})
			this.internalCB = async () => {
				this.timeout = undefined
				if (this.cb) await this.cb()
				this.resolver!()
			}
		}
		this.timeout = setTimeout(this.internalCB!, this.delay)
		return this.promise
	}

	get deferring() {
		return !!this.timeout
	}

	cancel() {
		if (!this.timeout) return
		clearTimeout(this.timeout)
		this.rejecter!('`Defer`red action canceled')
		this.timeout = undefined
	}

	resolve() {
		if (this.timeout) {
			clearTimeout(this.timeout)
			this.internalCB?.()
		}
		return this.promise
	}
}
