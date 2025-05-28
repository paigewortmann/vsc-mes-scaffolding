"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTemplateFiles = getTemplateFiles;
exports.getTemplateHTML = getTemplateHTML;
exports.createTemplate = createTemplate;
exports.initWebview = initWebview;
const vscode_1 = require("vscode");
const vsc = require("vsc-base");
const path = require("path");
function getTemplateFiles() {
    return __awaiter(this, void 0, void 0, function* () {
        const templateFiles = yield vsc.findFilePaths('**/*.vsc-template.{js,ts}');
        const templates = [];
        for (let filePath of templateFiles) {
            const match = filePath.match(/([\w\-]+)\.vsc\-template\.(ts|js)$/);
            if (match) {
                const content = yield vsc.getFileContent(filePath);
                const nameLabelMatch = content.match(/(?:^|\n)\s*\/\/vsc\-template\-name\:([^\n]*)/);
                const name = nameLabelMatch ? nameLabelMatch[1] : match[1];
                const type = match[2] === 'ts' ? 'ts' : 'js';
                templates.push({
                    area: ['Other'],
                    type,
                    name,
                    displayName: name,
                    name_lower: name.toLocaleLowerCase(),
                    path: filePath
                });
            }
        }
        if (templates.length === 0) {
            vsc.showErrorMessage(`No Templates Found`);
            return [];
        }
        return templates;
    });
}
function getTemplateHTML(templateName) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!templateName) {
            vsc.showErrorMessage("No template name provided");
            return null;
        }
        const templates = cachedTemplates || [];
        const selectedTemplate = templates.find(t => t.displayName === templateName);
        if (!selectedTemplate) {
            vsc.showErrorMessage("Template not found");
            return null;
        }
        const content = yield vsc.getFileContent(selectedTemplate.path);
        const webPreviewMatch = content.match(/content:\s*\(\s*inputs\s*\)\s*=>\s*`(<\!DOCTYPE html[\s\S]*?<\/html>)`/);
        if (!webPreviewMatch) {
            // vsc.showErrorMessage("No HTML found in template file");
            return null;
        }
        return webPreviewMatch[1].trim();
    });
}
let cachedTemplates = null;
function getCachedTemplates() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!cachedTemplates) {
            cachedTemplates = yield getTemplateFiles();
        }
        return cachedTemplates;
    });
}
const getJsTemplate = (path) => __awaiter(void 0, void 0, void 0, function* () {
    const templateFile = yield vsc.getFileContent(path);
    const templateCompiledFunction = eval(templateFile);
    const template = templateCompiledFunction();
    return template;
});
const getTsTemplate = (templatePath, path) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let scriptFileExport;
        scriptFileExport = yield vsc.tsLoadModule(templatePath);
        const verifiedModule = vsc.verifyModuleMethods(scriptFileExport, ['Template']);
        if (!verifiedModule) {
            return undefined;
        }
        const template = verifiedModule.Template(path, templatePath);
        return template;
    }
    catch (e) {
        vsc.showErrorMessage(e);
    }
    return undefined;
});
function loadTemplate(selectedTemplate, path) {
    return __awaiter(this, void 0, void 0, function* () {
        if (selectedTemplate.type === "js") {
            return yield getJsTemplate(selectedTemplate.path);
        }
        else if (selectedTemplate.type === "ts") {
            const template = yield getTsTemplate(selectedTemplate.path, path);
            return template ? (yield vsc.awaitResult(template)) : null;
        }
        return null;
    });
}
function createTemplate(uri, templateName, userInputs) {
    return __awaiter(this, void 0, void 0, function* () {
        const path = vsc.pathAsUnix(uri.fsPath);
        let dir = vsc.getDir(path);
        const templates = cachedTemplates || [];
        const selectedTemplate = templates.find(t => t.displayName === templateName);
        if (!selectedTemplate) {
            console.error("Template not found");
            return;
        }
        const template = yield loadTemplate(selectedTemplate, path);
        if (!template) {
            // vscode.window.showErrorMessage(`Failed to load ${selectedTemplate.type} template.`);
            // return;
            console.error(`Failed to load ${selectedTemplate.type} template.`);
            return;
        }
        yield template.template.forEach((item) => __awaiter(this, void 0, void 0, function* () {
            yield vsc.scaffoldTemplate(dir, item, userInputs);
        }));
        vscode_1.window.showInformationMessage(`Component ${userInputs.name} created with template ${selectedTemplate.displayName} `);
    });
}
function initWebview(context, uri) {
    return __awaiter(this, void 0, void 0, function* () {
        const panel = vscode_1.window.createWebviewPanel('mesScaffolding', 'MES Scaffolding', vscode_1.ViewColumn.One, { enableScripts: true });
        const cachedTemplates = getCachedTemplates();
        if (!uri) {
            vsc.showErrorMessage('vsc MES Scaffolding most be run by right-clicking a file or folder!');
            return;
        }
        panel.webview.onDidReceiveMessage((message) => __awaiter(this, void 0, void 0, function* () {
            switch (message.command) {
                case "startComponent":
                    panel.webview.postMessage({
                        command: "chooseTemplate",
                        templates: yield getCachedTemplates(),
                    });
                    break;
                case "templateSelected":
                    panel.webview.postMessage({
                        command: "askForName",
                        templateName: message.templateName,
                        htmlContent: yield getTemplateHTML(message.templateName),
                    });
                    break;
                case "createTemplate":
                    if (!message.templateName) {
                        vscode_1.window.showErrorMessage("Invalid Template Name");
                        return;
                    }
                    const templates = yield cachedTemplates;
                    const selectedTemplate = templates.find(t => t.displayName === message.templateName);
                    if (!selectedTemplate) {
                        panel.webview.postMessage({ command: "error", message: "Template not found." });
                        return;
                    }
                    yield createTemplate(uri, message.templateName, message.userInputs);
                    break;
            }
        }));
        const cssPath = vscode_1.Uri.file(path.join(context.extensionPath, "src", "styles.css"));
        const cssUri = panel.webview.asWebviewUri(cssPath);
        // const cssUri = panel.webview.asWebviewUri(
        //    Uri.joinPath(context.extensionUri, "/src", "styles.css")
        // );
        // console.log(cssUri)
        panel.webview.html = `
      
   <html>
    <head>
        <link rel="stylesheet" href="${cssUri}">
    </head>
    <body>
        <div class="container">
            <h2 class="header">MES Scaffolding</h2>
            <div class="sidebar">
                <div id="templateCardsContainer"></div>
                <button id="createComponent" >Create Component</button>
            </div>
            <div class="content" id="templateContent"></div>
        </div>
        <script>
            
const vscode = acquireVsCodeApi();
let selectedTemplate = null;

checkValidation()

window.addEventListener("DOMContentLoaded", () => {
    vscode.postMessage({ command: "startComponent" });
});

window.addEventListener("message", (event) => {
    const contentArea = document.getElementById("templateContent");
    const templateCardsContainer = document.getElementById("templateCardsContainer");

    switch (event.data.command) {
        case "chooseTemplate":
            templateCardsContainer.innerHTML = "";

            if (!event.data.templates || event.data.templates.length === 0) {
                console.error("No templates found.");
                return;
            }

            event.data.templates.forEach(t => {
                const card = document.createElement("div");
                card.classList.add("template-card");
                card.textContent = t.displayName;

                card.addEventListener("click", () => {
                    selectedTemplate = t.displayName;
                    vscode.postMessage({ command: "templateSelected", templateName: t.displayName });

                    const selectedCard = document.querySelector(".selected");
                    if (selectedCard) selectedCard.classList.remove("selected");
                    card.classList.add("selected");
                     
                });

                templateCardsContainer.appendChild(card);
            });
            break;

        case "askForName":
            contentArea.innerHTML = "";

            const label = document.createElement("div");
            label.textContent = "Enter a component name:";
            const input = document.createElement("input");
            input.type = "text";
            input.id = "name";
            input.addEventListener("input", checkValidation);

            contentArea.appendChild(label);
            contentArea.appendChild(input);

            const iframe = document.createElement("iframe");
            if (!event.data.htmlContent || event.data.htmlContent.trim() === "null") {
               iframe.classList.add("null-content");
               iframe.srcdoc = "<div class='null-message' style='font-family: Arial, sans-serif; font-size: 4vh;'>No content available</div>";
            } else {
               iframe.classList.add("template-frame");
               iframe.setAttribute("srcdoc", event.data.htmlContent);
            }
            contentArea.appendChild(iframe);


    }
});


function checkValidation() {
    const createBtn = document.getElementById("createComponent");
    const nameInput = document.getElementById("name");

    createBtn.disabled = !selectedTemplate && !nameInput?.value.trim();
}

document.getElementById("createComponent").addEventListener("click", () => {
    if (!selectedTemplate || !document.getElementById("name")?.value.trim()) return;

    vscode.postMessage({
        command: "createTemplate",
        templateName: selectedTemplate,
        userInputs: { name: document.getElementById("name").value.trim() }
    });
});

vscode.postMessage({ command: "startComponent" });
vscode.postMessage({ command: "askForName" });
checkValidation();


        </script>
    </body>
</html>
   `;
    });
}
//# sourceMappingURL=Webview.js.map