export type Transferred<T> = {
	[K in keyof T]: T[K] extends (...args: infer A) => infer R
		? R extends Promise<any>
			? T[K] // If the return type is already a Promise, keep it as is
			: (...args: A) => Promise<R> // Otherwise, wrap the return type in a Promise
		: T[K] // For non-function properties, leave them unchanged
}

const undefinedServerMethod = Symbol('undefinedServerMethod'),
	undefinedClientMethod = Symbol('undefinedClientMethod')

function reservedServerMethod() {
	throw undefinedServerMethod
}
function reservedClientMethod() {
	throw undefinedClientMethod
}
export function rpcServerMethod<T extends (...args: any[]) => any>(): T {
	return <T>reservedServerMethod
}

export function rpcClientMethod<T extends (...args: any[]) => any>(): T {
	return <T>reservedClientMethod
}
