/**
 * Always a (new) promise: once resolved, can be waited again
 * Also, `resolve` and `reject` are exposed
 */
export class PromiseSequence<T = any> implements Promise<T> {
	private currentPromise: {
		resolve: (value: T | PromiseLike<T>) => void
		reject: (reason?: any) => void
		promise: Promise<T>
	}
	resolve(value: T | PromiseLike<T>) {
		return this.currentPromise.resolve(value)
	}
	reject(reason?: any) {
		return this.currentPromise.reject(reason)
	}

	private createPromise() {
		let resolve: (value: T | PromiseLike<T>) => void
		let reject: (reason?: any) => void
		const promise = new Promise<T>((_resolve, _reject) => {
			resolve = _resolve
			reject = _reject
		}).then((x) => {
			this.currentPromise = this.createPromise()
			return x
		})
		return { resolve: resolve!, reject: reject!, promise }
	}
	constructor() {
		// we have to c/p to avoid "not initialized" error
		this.currentPromise = this.createPromise()
	}
	readonly [Symbol.toStringTag]: string = 'PromiseSequence'
	then<TResult1 = T, TResult2 = never>(
		onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
	): Promise<TResult1 | TResult2> {
		return this.currentPromise.promise.then(onfulfilled, onrejected)
	}
	catch<TResult = never>(
		onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined
	): Promise<T | TResult> {
		return this.currentPromise.promise.catch(onrejected)
	}
	finally(onfinally?: (() => void) | null | undefined): Promise<T> {
		return this.currentPromise.promise.finally(onfinally)
	}
}
