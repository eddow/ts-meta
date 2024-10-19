interface Example {
	id: number
	name: string
	isActive: boolean
	age: number
	score: number
	isVerified: boolean
}

// Utility type to extract only number fields
type NumberFields<T> = {
	[K in keyof T]: T[K] extends number ? K : never
}[keyof T]

// Type to pick only number fields
type OnlyNumbers<T> = Pick<T, NumberFields<T>>

// Result type with only number fields
type Result = OnlyNumbers<Example>
