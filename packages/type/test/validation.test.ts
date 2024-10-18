import { typed } from '../src'

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
		expect(() => (test.foo = <string>(<unknown>5))).toThrow()
	})
})
