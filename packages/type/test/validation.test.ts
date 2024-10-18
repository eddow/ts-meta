import {
	ArrayTypeErrorDesc,
	GivenTypeErrorDesc,
	literal,
	optionals,
	typed,
	validated
} from '../src'

describe('validation', () => {
	it('properties', () => {
		@typed()
		class Test {
			@typed()
			foo: string = ''
		}
		const test = new Test()
		test.foo = 'qwe'
		expect(test.foo).toBe('qwe')
		expect(() => (test.foo = <string>(<unknown>5))).toThrow('Wrong primitive')
	})
	it('functions', () => {
		@typed()
		class Test {
			@validated()
			tf(foo: string, bar: number): string {
				return foo + bar
			}
		}
		const test = new Test()
		expect(test.tf('qwe', 5)).toBe('qwe5')
		expect(() => test.tf(<string>(<unknown>5), 5)).toThrow('Wrong mandatory tuple entry')
	})
	it('parameters', () => {
		@typed()
		class Test {
			@validated()
			tf(foo: string, @typed([1, 2]) @optionals bar: number = 2): string {
				return foo + bar
			}
		}
		const test = new Test()
		//expect(test.tf('qwe')).toBe('qwe2')
		expect(() => test.tf('qwe', 5)).toThrow('Wrong optional tuple entry')
	})
})
