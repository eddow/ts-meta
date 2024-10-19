import { side, definitionOnly } from '../src'

let userIdSpace = 0
const [server, client] = [side('server'), side('client')]
//#region common

class User {
	readonly id: number = 0
	name: string = ''
	@client
	update(change: Partial<User>): Client<void> {
		throw definitionOnly
	}
}

class UserListInterface {
	@server
	create(name: string): Server<User> {
		throw definitionOnly
	}
}

//#endregion
//#region server
class UserList extends UserListInterface {
	create(name: string): User {
		return initialized(User, { id: ++userIdSpace, name })
	}
}
//#endregion
//#region client

//const ClientUserList = transferable.client(UserListInterface)

//#endregion
const rpcGlobals = {
	users: UserListInterface
}
