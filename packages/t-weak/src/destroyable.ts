const fr = new FinalizationRegistry<() => void>((f) => f())
/**
 * Allows to register a function to be called when the object is destroyed
 * Note: The behavior is highly dependant on the garbage collector
 */
export class Destroyable {
	private isAlive = true
	constructor(private readonly destructor: () => void) {
		fr.register(this, destructor, this)
	}
	get destroyed() {
		return !this.isAlive
	}
	destroy() {
		fr.unregister(this)
		this.isAlive = false
		this.destructor()
	}
}
