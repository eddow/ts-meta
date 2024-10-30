const fr = new FinalizationRegistry<() => void>((f) => f())
/**
 * Allows to register a function to be called when the object is destroyed
 * Note: The behavior is highly dependant on the garbage collector
 */
export class Destroyable {
	private isAlive = true
	/**
	 *
	 * @param destructor The function to call after object destruction. The object SHOULD NOT BE USED in the scope of the destructor or it would never be destroyed automatically
	 */
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
