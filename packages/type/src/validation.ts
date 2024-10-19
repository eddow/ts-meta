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

function validateParameters<T extends object = any>(
	type: TypeDefinition,
	target: T,
	propertyKey: keyof T & (string | symbol),
	index: number
): void {
	if (!type) {
		// Infer type from the metadata
		type = Reflect.getMetadata('design:paramtypes', target, propertyKey)[index]
		switch (type) {
			case Object:
				type = any
				metaValidation.warn(
					`Type for parameter ${index} of method ${String(propertyKey)} in ${(<T>target).constructor.name} cannot be inferred. \`any\` used.`
				)
				break
			case Array:
				type = array(any)
				metaValidation.warn(`Type of array elements for parameter ${index} of method ${String(propertyKey)} in ${(<T>target).constructor.name} cannot be inferred.
	Use « @typed(Array) » to assume « any[] ».`)
				break
		}
	}
	const fct = metadata<ValidatedFunction>('function:descriptor', <T>target, propertyKey)
	if (!fct.argumentTypes) fct.argumentTypes = []
	fct.argumentTypes[index] = type
}

function validateField<T extends object = any>(
	type: TypeDefinition,
	target: T,
	propertyKey: keyof T & (string | symbol)
): void {
	if (!type) {
		// Infer type from the metadata
		type = Reflect.getMetadata('design:type', target, propertyKey)
		switch (type) {
			case Object:
				type = any
				metaValidation.warn(
					`Type for field ${String(propertyKey)} in ${(<T>target).constructor.name} cannot be inferred. \`any\` used.`
				)
				break
			case Array:
				type = array(any)
				metaValidation.warn(`Type of array elements for property ${String(propertyKey)} in ${(<T>target).constructor.name} cannot be inferred.
	Use « @typed(Array) » to assume « any[] ».`)
				break
		}
	}
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

function validateMethod<T extends object = any>(
	type: TypeDefinition,
	target: T,
	propertyKey: keyof T & (string | symbol),
	descriptor: PropertyDescriptor
): PropertyDescriptor {
	const fct = metadata<ValidatedFunction>('function:descriptor', <T>target, propertyKey)
	fct.returnType = type || Reflect.getMetadata('design:returntype', target, propertyKey)
	if (!type) {
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

function validateConstructor<T extends object = any>(target: Constructor<T>): Constructor<T> {
	return <Constructor<T>>class extends (<Constructor>target) {
		constructor() {
			super()
			cleanInstance(this)
		}
	}
}

export function typed<T extends object = any>(
	type?: TypeDefinition
): (
	target: T | Constructor,
	propertyKey?: keyof T & (string | symbol),
	index?: number | PropertyDescriptor
) => any {
	return function typedDecoration(
		target: T | Constructor,
		propertyKey?: keyof T & (string | symbol),
		index?: number | PropertyDescriptor
	): void | PropertyDescriptor | Constructor<T> {
		return propertyKey === undefined
			? validateConstructor(<Constructor<T>>target)
			: index === undefined
				? validateField(type, <T>target, propertyKey)
				: typeof index === 'number'
					? validateParameters(type, <T>target, propertyKey, index)
					: validateMethod(type, <T>target, propertyKey, index)
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
