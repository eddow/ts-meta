import { TypeDefinition, typeError, wildcards } from './type'
import 'reflect-metadata'

export interface ValidatedFunction {
	arguments: TypeDefinition[]
	returnType: TypeDefinition
	mandatory?: number
	rest?: true
}

export interface ValidatedClass<T extends object = any> {
	properties?: Partial<Record<keyof T, TypeDefinition>>
}

export function typed<T extends object = any>(target: T, propertyKey: string, index: number): void
export function typed<T extends object = any>(
	type?: TypeDefinition
): (target: T, propertyKey: keyof T, index?: number) => void
export function typed<T extends object = any>(
	target: T | TypeDefinition = wildcards.any,
	propertyKey?: keyof T,
	index?: number
) {
	let type: TypeDefinition =
		propertyKey === undefined
			? target
			: index === undefined
				? Reflect.getMetadata('design:type', <T>target, <string | symbol>propertyKey)
				: Reflect.getMetadata('design:paramtypes', <T>target, <string | symbol>propertyKey)[index]
	if (type === Object) type = wildcards.any
	function decoration(target: T, propertyKey: keyof T, index?: number): void {
		if (index !== undefined) {
			// Parameter
			const fct = <Partial<ValidatedFunction>>target[propertyKey]
			if (!fct.arguments) fct.arguments = []
			fct.arguments[index] = type
		} else {
			// Property
			const cls = <Partial<ValidatedClass<T>>>target
			if (!cls.properties) cls.properties = {}
			cls.properties[propertyKey] = type
			let internalValue = target[propertyKey]
			Object.defineProperty(target, propertyKey, {
				enumerable: true,
				writable: true,
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
	return propertyKey !== undefined ? decoration(<T>target, propertyKey, index) : decoration
}
