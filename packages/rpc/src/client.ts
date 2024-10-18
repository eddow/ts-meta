import { Transferred } from './common'
export * from './transferable'
export * from './common'

export class RpcClient<G extends Record<string, any>> {
	constructor(public readonly globals: G) {}
	global<T extends keyof G>(name: keyof G): Transferred<T> {
		return this.globals[name]
	}
}
