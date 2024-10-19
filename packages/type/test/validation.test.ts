import { optionals, rest, typed } from '../src'

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
			@typed()
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
			@typed()
			tf(foo: string, @typed([1, 2]) @optionals bar: number = 2): string {
				return foo + bar
			}
		}
		const test = new Test()
		expect(test.tf('qwe')).toBe('qwe2')
		expect(() => test.tf('qwe', 5)).toThrow('Wrong optional tuple entry')
	})
	it('return value', () => {
		@typed()
		class Test {
			@typed()
			tf(foo: string, bar: number): string {
				return bar < 3 ? foo + bar : <string>(<unknown>5) + bar
			}
		}
		const test = new Test()
		expect(test.tf('qwe', 2)).toBe('qwe2')
		expect(() => test.tf('qwe', 5)).toThrow('Wrong primitive')
	})
	it('rest', () => {
		@typed()
		class Test {
			@typed()
			tf(foo: string, @rest(Number) ...bar: number[]): string {
				return foo + bar.reduce((acc, val) => acc + val, 0)
			}
		}
		const test = new Test()
		expect(test.tf('qwe', 2, 3)).toBe('qwe5')
		expect(() => test.tf('qwe', 5, <number>(<unknown>'asd'))).toThrow('Wrong rest tuple entry')
	})
})
