import { Uri, ExtensionContext, commands} from 'vscode';

// import Scaffolding from './Scaffolding'
import { initWebview } from './Webview'


export function activate(context: ExtensionContext) {

	console.log('Congratulations, your extension "vsc-scaffolding" is now active!')



	let webviewDisposable = commands.registerCommand(
		'extension.vscMesScaffolding',
		(uri: Uri) => {
			context.globalState.update("storedUri", uri.fsPath); 
			initWebview(context, uri);
		}
	)


	context.subscriptions.push(webviewDisposable)
}

export function deactivate() { }




