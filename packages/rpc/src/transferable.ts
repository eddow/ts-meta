import 'reflect-metadata'
import { TypeDefinition } from '@ts-meta/type'

interface RpcFunction {
	arguments: TypeDefinition[]
	returnType: TypeDefinition
	mandatory?: number
	rest?: true
}
interface RpcClass<T> {
	new (): T
	serverFunctions?: Record<string, RpcFunction>
	clientFunctions?: Record<string, RpcFunction>
}

const transferable = {
	type<T extends object = any>(
		type: TypeDefinition
	): (target: T, propertyKey: string, index?: number) => void {
		return function decoration(target: T, propertyKey: string, index?: number) {}
	},
	// validate(...)

	optionals(target: any, propertyKey: string, index: number) {},

	server(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		/*
		const paramTypes = Reflect.getMetadata('design:paramtypes', target, propertyKey)
		const returnType = Reflect.getMetadata('design:returntype', target, propertyKey)
		debugger*/

		return descriptor
	},

	object<T = any>(target: RpcClass<T>) {
		/*
		target.functions = {}
		const pd = Object.getOwnPropertyDescriptors(target.prototype)
		for (const key in pd) {
			//console.log(key)
			if (typeof pd[key].value === 'function') {
				/*const paramTypes = Reflect.getMetadata('design:paramtypes', target, key)
				const returnType = Reflect.getMetadata('design:returntype', target, key)
				debugger* /
			}
		}*/
	},

	definitionOnly: Symbol('rpc.definitionOnly')
}

export { transferable }
