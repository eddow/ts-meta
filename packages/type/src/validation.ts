import { any, array, Constructor, tuple, TypeDefinition, typeError } from './type'
import 'reflect-metadata'

/**
 * At least with ts-jest, a field initialized in the constructor will be both an accessor (get/set) in the prototype
 * AND a field in the instance.
 * @param instance instance to clean
 */
function cleanInstance(instance: any) {
	for (const own of Object.getOwnPropertyNames(instance)) {
		// Make sure it's not an instance property and uses the accessors
		const value = instance[own]
		delete instance[own]
		instance[own] = value
	}
}

class ValidationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'ValidationError'
	}
}

/**
 * Override default behaviors here
 */
export const metaValidation = {
	warn(...args: any[]) {
		console.warn(...args)
	}
}

export interface ValidatedFunction {
	argumentTypes: TypeDefinition[]
	returnType: TypeDefinition
	optionals?: number
	rest?: TypeDefinition
}
function metadata<DataType extends object>(
	mdKey: string,
	target: any,
	propertyKey?: string | symbol
): Partial<DataType> {
	let md: Partial<DataType> =
		propertyKey !== undefined
			? Reflect.getMetadata(mdKey, target, propertyKey)
			: Reflect.getMetadata(mdKey, target)
	if (!md) {
		if (propertyKey !== undefined) Reflect.defineMetadata(mdKey, (md = {}), target, propertyKey)
		else Reflect.defineMetadata(mdKey, (md = {}), target)
	}
	return md
}

export function typed<T extends object = any>(
	type?: TypeDefinition
): (target: T, propertyKey?: keyof T & (string | symbol), index?: number) => void
export function typed<T extends object = any>(
	type?: TypeDefinition
): (target: T | Constructor, propertyKey?: keyof T & (string | symbol), index?: number) => void {
	return function typedDecoration(
		target: T | Constructor,
		propertyKey?: keyof T & (string | symbol),
		index?: number
	): void | Function {
		if (propertyKey === undefined) {
			// class decorator
			return class extends (<Constructor>target) {
				constructor() {
					super()
					cleanInstance(this)
				}
			}
		}
		if (!type) {
			type =
				index === undefined
					? Reflect.getMetadata('design:type', <T>target, propertyKey)
					: Reflect.getMetadata('design:paramtypes', <T>target, propertyKey)[index]
			if (type === Object) {
				type = any
				metaValidation.warn(
					index === undefined
						? `Type for property ${String(propertyKey)} in ${(<T>target).constructor.name} cannot be inferred.
	Please specify it explicitly or decorate with « @typed(any) ».`
						: `Type for parameter ${index} of method ${String(propertyKey)} in ${(<T>target).constructor.name} cannot be inferred.
	Please specify it explicitly or decorate with « @typed(any) ».`
				)
			}
			if (type === Array) {
				type = array(any)
				metaValidation.warn(
					index === undefined
						? `Type of array elements for property ${String(propertyKey)} in ${(<T>target).constructor.name} cannot be inferred.
	Please specify it explicitly or decorate with « @typed(Array) » to assume « any[] ».`
						: `Type of array elements for parameter ${index} of method ${String(propertyKey)} in ${(<T>target).constructor.name} cannot be inferred.
	Please specify it explicitly or decorate with « @typed(Array) » to assume « any[] ».`
				)
			}
		}
		if (index !== undefined) {
			// Parameter
			const fct = metadata<ValidatedFunction>('function:descriptor', <T>target, propertyKey)
			if (!fct.argumentTypes) fct.argumentTypes = []
			fct.argumentTypes[index] = type
		} else {
			let internalValue = (<T>target)[propertyKey]
			Object.defineProperty(target, propertyKey, {
				enumerable: true,
				set(value: any) {
					const error = typeError(value, type)
					if (error) throw error
					internalValue = value
				},
				get() {
					return internalValue
				}
			})
		}
	}
}

export function optionals<T extends object = any>(
	target: T,
	propertyKey: keyof T & (string | symbol),
	index: number
) {
	const fct = metadata<ValidatedFunction>('function:descriptor', <T>target, propertyKey)
	if (fct.optionals !== undefined)
		throw new ValidationError(
			`@optionals can only be specified once by method. Here, at argument ${fct.optionals} and ${index}.`
		)
	fct.optionals = index
}

export function rest<T extends object = any>(type: TypeDefinition) {
	return function restDecoration(
		target: T,
		propertyKey: keyof T & (string | symbol),
		index: number
	) {
		const fct = metadata<ValidatedFunction>('function:descriptor', <T>target, propertyKey)
		if (
			index !==
			Reflect.getMetadata('design:paramtypes', <T>target, <string | symbol>propertyKey).length - 1
		)
			throw new ValidationError(
				`@rest can only be used as last argument of a method. Here, at argument ${index}.`
			)
		fct.rest = type
	}
}

export function validated<T extends object = any>(
	target: T,
	propertyKey: string,
	descriptor: PropertyDescriptor
): void
export function validated<T extends object = any>(
	type?: TypeDefinition
): (
	target: T,
	propertyKey: keyof T & (string | symbol),
	descriptor: PropertyDescriptor
) => PropertyDescriptor
export function validated<T extends object = any>(
	target?: T | TypeDefinition, // type definition === undefined => any
	propertyKey?: keyof T & (string | symbol),
	descriptor?: PropertyDescriptor
) {
	const returnType =
		propertyKey === undefined
			? <TypeDefinition>target
			: Reflect.getMetadata('design:returntype', <T>target, <string | symbol>propertyKey)
	function validatedDecoration(
		target: T,
		propertyKey: keyof T & (string | symbol),
		descriptor: PropertyDescriptor
	) {
		const fct = metadata<ValidatedFunction>('function:descriptor', <T>target, propertyKey)
		fct.returnType = returnType || Reflect.getMetadata('design:returntype', target, propertyKey)
		if (!returnType) {
			// TODO validate and warn
		}
		if (!fct.argumentTypes) fct.argumentTypes = []
		fct.argumentTypes = Reflect.getMetadata(
			'design:paramtypes',
			<T>target,
			<string | symbol>propertyKey
		).map((paramType: Constructor, index: number) => {
			if (fct.argumentTypes![index]) return fct.argumentTypes![index]
			// TODO validate and warn
			return paramType
		})
		const done = <ValidatedFunction>fct
		const totalLength = done.rest ? done.argumentTypes.length - 1 : done.argumentTypes.length
		const argsTuple =
			done.optionals !== undefined
				? tuple(
						done.argumentTypes?.slice(0, done.optionals),
						done.argumentTypes?.slice(done.optionals, totalLength),
						done.rest
					)
				: tuple(done.argumentTypes?.slice(0, totalLength), [], done.rest)

		return <PropertyDescriptor>{
			...descriptor,
			value: function validator(...args: any[]) {
				const argError = typeError(args, argsTuple)
				if (argError) throw argError
				const result = descriptor.value.apply(this, args)
				if (done.returnType !== undefined) {
					const resultError = typeError(result, done.returnType)
					if (resultError) throw resultError
				}
				return result
			}
		}
	}
	return propertyKey !== undefined
		? validatedDecoration(<T>target, propertyKey, descriptor!)
		: validatedDecoration
}
