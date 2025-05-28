"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode_1 = require("vscode");
// import Scaffolding from './Scaffolding'
const Webview_1 = require("./Webview");
function activate(context) {
    console.log('Congratulations, your extension "vsc-scaffolding" is now active!');
    // const scaffolding = new Scaffolding()
    // let disposable = commands.registerCommand(
    // 	'extension.vscScaffolding',
    // 	(uri?: Uri, uris?: Uri[]) => {
    // 		scaffolding.createTemplate(uri)
    // 	}
    // )
    let webviewDisposable = vscode_1.commands.registerCommand('extension.vscMesScaffolding', (uri) => {
        context.globalState.update("storedUri", uri.fsPath);
        (0, Webview_1.initWebview)(context, uri);
    });
    context.subscriptions.push(webviewDisposable);
    // context.subscriptions.push(disposable)
    // context.subscriptions.push(webviewDisposable)
}
function deactivate() { }
//# sourceMappingURL=extension.js.map